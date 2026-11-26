/* =========================================================================
   转生千金 · 双层因果暗流引擎 (Micro-Vignettes -> S.causal -> Macro-Payoffs)
   负责：5组双轴关系塑造、4枚暗线拼图、往昔回声池、8个双幕双模小场景、6大主线蝴蝶效应与舞台情绪徽章
   ========================================================================= */
(function (root) {
  'use strict';

  var MAX_ECHOES = 8;

  function bdIco(name, size) {
    var sz = size || 14;
    var paths = {
      wind: '<path d="M2.5 7h8.2a2.1 2.1 0 1 0-2-2.7"/><path d="M2.5 10.5h11a2.1 2.1 0 1 1-2 2.7"/><path d="M2.5 14h5.5"/>',
      droplet: '<path d="M9 2.5C9 2.5 4 8 4 11.4a5 5 0 0 0 10 0C14 8 9 2.5 9 2.5Z"/>',
      crown: '<path d="M3 13.5h12l1-7.5-3.8 3L9 4.5 5.8 9 2 6l1 7.5Z"/>',
      crystal: '<polygon points="9,2 14,6 14,12 9,16 4,12 4,6"/><path d="M9 2v14M4 6l10 6M14 6L4 12"/>',
      butterfly: '<path d="M9 6.5C7.2 3.5 3 3.5 3 7c0 2 1.8 3.2 4 3.2-1.8.4-3 1.6-3 3.1 0 2 2.5 2.5 5 0"/><path d="M9 6.5c1.8-3 6-3 6 .5 0 2-1.8 3.2-4 3.2 1.8.4 3 1.6 3 3.1 0 2-2.5 2.5-5 0"/><path d="M9 5.5v8"/>',
      notebook: '<rect x="4" y="2.5" width="10" height="13" rx="1.5"/><path d="M6.8 2.5v13M9.2 6h2.8M9.2 9h2.8M9.2 12h2"/>',
      chess: '<circle cx="9" cy="5.2" r="2.2"/><path d="M6.5 8.5h5L10.8 13H7.2L6.5 8.5Z"/><path d="M4.5 15.2h9"/>',
      snowflake: '<path d="M9 2.2v13.6M3.1 5.6l11.8 6.8M14.9 5.6L3.1 12.4M7.2 3.8L9 5.2l1.8-1.4M7.2 14.2L9 12.8l1.8 1.4M4 7.5l1.6-.2.4-1.6M14 10.5l-1.6.2-.4 1.6M14 7.5l-1.6-.2-.4-1.6M4 10.5l1.6.2.4 1.6"/>',
      leaf: '<path d="M14.5 3.5C9 3.5 4.5 6.8 4 14c7.2-.5 10.5-5 10.5-10.5Z"/><path d="M4 14l5.5-5.5"/>',
      candle: '<path d="M9 2.5c1.3 1.5 1.6 2.8.8 3.8a1.4 1.4 0 0 1-1.6 0c-.8-1-.5-2.3.8-3.8Z"/><rect x="6.5" y="8" width="5" height="7" rx="1"/><path d="M4.5 15h9"/>',
      scroll: '<path d="M5 3.5h8.5a1.5 1.5 0 0 1 0 3H5.5v8a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 2.5-1.5Z"/><path d="M5.5 6.5H13v6.5a2 2 0 0 1-2 2H4"/><path d="M7.5 9.2h3.5M7.5 11.8h2.5"/>',
      feather: '<path d="M14.5 3.5C10.5 3.8 7 6.2 5 11.5L3.5 14.5l3-1.5c4.5-1.8 7.6-5.2 8-9.5Z"/><path d="M5 13l6.5-6.5"/>',
      compass: '<path d="M3.5 14.5h11V3.5L3.5 14.5Z"/><path d="M9.5 12h2.5V9.5"/>',
      diamond: '<polygon points="9,2.2 15.8,9 9,15.8 2.2,9"/><circle cx="9" cy="9" r="1.8"/>',
      flame: '<path d="M9.5 2.5c2.2 2.4 4.2 5 4.2 7.8a4.7 4.7 0 0 1-9.4 0c0-2 1-3.6 2.2-4.8-.1 1.4.6 2.3 1.5 2.5.1-2 .8-3.9 1.5-5.5Z"/>',
      cat: '<path d="M4 7.5V3.5l3 2.2a6.4 6.4 0 0 1 4 0l3-2.2v4a5 5 0 1 1-10 0Z"/><path d="M7.2 9.5h.1M10.7 9.5h.1M8.2 11.5c.5.4 1.1.4 1.6 0"/>',
      sparkle: '<path d="M9 2.2L10.7 7.3L15.8 9L10.7 10.7L9 15.8L7.3 10.7L2.2 9L7.3 7.3Z"/>',
      bowl: '<path d="M3 9.5h12a5.5 5.5 0 0 1-11 0Z"/><path d="M6.5 15h5M6.5 6.5c0-1 .7-1.4.7-2.4M9 6.5c0-1 .7-1.4.7-2.4M11.5 6.5c0-1 .7-1.4.7-2.4"/>',
      lantern: '<path d="M7 3h4M9 2v1M6.5 14.5h5M9 14.5V16"/><rect x="5" y="4.5" width="8" height="9" rx="3.5"/><path d="M5.2 9h7.6"/>',
      sword: '<path d="M14.5 3.5l-3.8.7-4.8 4.8 2.4 2.4 4.8-4.8.7-3.8Z"/><path d="M4.8 9.2l4 4M3.5 14.5l2.5-2.5"/>',
      pass: '<rect x="3" y="4.2" width="12" height="9.6" rx="1.8"/><circle cx="6.8" cy="9" r="1.4"/><path d="M10 7.6h3M10 10.4h2.4"/>',
      cake: '<circle cx="9" cy="9" r="5.6"/><path d="M9 5.5v7M5.5 9h7M6.6 6.6l4.8 4.8M11.4 6.6l-4.8 4.8"/>'
    };
    var body = paths[name] || paths.sparkle;
    return '<svg class="bd-svg-ico" viewBox="0 0 18 18" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  }

  var STAGE_EMO_BADGES = {
    shy: '✿ 微赧',
    happy: '✧ 欣喜',
    smile: '✧ 浅笑',
    serious: '❖ 凝神',
    sad: '◇ 黯然',
    teary: '◇ 含泪',
    surprised: '✦ 微怔',
    wink: '☆ 狡黠',
    sleepy: '☾ 困倦'
  };

  /**
   * 5 位核心角色的双轴定义（左轴 <-> 右轴）
   */
  var AXIS_META = {
    alice: {
      charId: 'alice',
      name: '爱丽丝',
      icon: bdIco('wind'),
      leftKey: 'independence',
      leftLabel: '独立思考',
      leftDesc: '引导她自己聆听风向、丈量更广阔的天地',
      rightKey: 'obsession',
      rightLabel: '执念依恋',
      rightDesc: '纵容她将全部视线与呼吸系在姐姐身侧'
    },
    noelle: {
      charId: 'noelle',
      name: '诺艾儿',
      icon: bdIco('droplet'),
      leftKey: 'partnership',
      leftLabel: '平等同盟',
      leftDesc: '无需客套设防、彼此平视的学术与实战挚友',
      rightKey: 'guarded_pride',
      rightLabel: '自尊防线',
      rightDesc: '紧绷着平民首席的敏感骄傲，人情必当算清'
    },
    charlotte: {
      charId: 'charlotte',
      name: '夏洛特',
      icon: bdIco('crown'),
      leftKey: 'candor',
      leftLabel: '卸下面具',
      leftDesc: '树影与薄荷茶间不言自明的体面与默契',
      rightKey: 'rivalry',
      rightLabel: '骄傲较劲',
      rightDesc: '榜单与考场上寸步不让的同辈宿敌锋芒'
    },
    aino: {
      charId: 'aino',
      name: '艾诺',
      icon: bdIco('crystal'),
      leftKey: 'kinship',
      leftLabel: '极北知己',
      leftDesc: '同守一盆北极铃兰、共懂异乡温差的同类',
      rightKey: 'austere_mentor',
      rightLabel: '严苛试炼',
      rightDesc: '以生死实战标准纯粹磨砺冰锋的对手'
    },
    jilan: {
      charId: 'jilan',
      name: '霁岚',
      icon: bdIco('butterfly'),
      leftKey: 'hearth',
      leftLabel: '归处暖灯',
      leftDesc: '小院热粥与木桩声里随时可回的安稳灯火',
      rightKey: 'wanderlust',
      rightLabel: '并肩远行',
      rightDesc: '系上紫蝶剑穗、终将在塞北风雪重逢的剑客之约'
    }
  };

  var POLE_TO_CHAR = {};
  Object.keys(AXIS_META).forEach(function (cid) {
    POLE_TO_CHAR[AXIS_META[cid].leftKey] = cid;
    POLE_TO_CHAR[AXIS_META[cid].rightKey] = cid;
  });

  /**
   * 4 枚暗线警觉与情报拼图定义
   */
  var CLUE_META = {
    bayi_banquet_leak: {
      id: 'bayi_banquet_leak',
      icon: bdIco('notebook'),
      title: '宴席食谱外的暗探',
      hint: '学院公共厨房里，留意阿琼替表叔记录的公爵府宴会细节。',
      summary: '有人借单纯的阿琼打探公爵府三代纹章银杯、客房位置与夜巡换班规律，巴依使团内部藏着伸向维斯特利亚家的眼线。',
      allowedPhases: ['academy', 'finale', 'journey']
    },
    belmont_troop_shift: {
      id: 'belmont_troop_shift',
      icon: bdIco('chess'),
      title: '王都调防与封锁苗头',
      hint: '在纪念林雨后或日落长廊的闲谈中，捕捉王都外务与边境盘查的异动。',
      summary: '贝尔蒙家族外务管事近期频繁调动城郊私军，沿途驿站与边境关卡盘查骤紧，一张针对旧外交体系的网正在收拢。',
      allowedPhases: ['childhood', 'youth', 'academy', 'finale', 'journey']
    },
    polar_lily_bond: {
      id: 'polar_lily_bond',
      icon: bdIco('snowflake'),
      title: '北极铃兰的冰膜印记',
      hint: '在校园花坊午后，与艾诺一同照料怕热的北极铃兰「伊诺」。',
      summary: '掌握了极弱而均匀的恒温冰膜控温术，也窥见了霍尔老师六年如一日在窗台下为赫兰游子铺设冻土白霜的无言守护。',
      allowedPhases: ['academy', 'finale', 'journey']
    },
    wind_god_echo: {
      id: 'wind_god_echo',
      icon: bdIco('leaf'),
      title: '院角老树与「岚」之名',
      hint: '在澄岚镇霁馆夜廊，听霁岚提起父亲每晚驻足的老树。',
      summary: '霁馆院角修剪整齐的老树下藏着霁清馆主对故人「岚」的守望，那缕自由却难以久驻的风与远方风暴眼隐隐共鸣。',
      allowedPhases: ['journey', 'finale']
    }
  };

  /**
   * 6 大主线关卡蝴蝶效应台账（覆盖全部 4 枚线索与全部 5 组关系双轴）
   */
  var PAYOFF_META = {
    dark_tide: {
      id: 'dark_tide',
      icon: bdIco('candle'),
      title: '暗潮先觉 · 书房推演',
      stage: '第十章 · 政变前夜',
      condDesc: '拼合「宴席食谱外的暗探」与「王都调防苗头」两枚暗流线索',
      effectDesc: '政变前夜在书房拼出使团被拦与私军合围死局，提前向父亲与雷纳德示警，留下霜封暗记并强化心智与魔力。'
    },
    rival_grace: {
      id: 'rival_grace',
      icon: bdIco('scroll'),
      title: '宿敌回响 · 巡防抄件与战书',
      stage: '第十章 · 离校与东逃夜',
      condDesc: '夏洛特积累「卸下面具」或「骄傲较劲」倾向（≥2）',
      effectDesc: '倾向卸下面具时夏洛特暗留东郊骑兵换防时间表助逃亡无损过关；倾向骄傲较劲时留下不许败于旁人之手的战书羊皮笺砥砺锋芒。'
    },
    alice_arc: {
      id: 'alice_arc',
      icon: bdIco('feather'),
      title: '风之弧光 · 家书与重逢',
      stage: '学院篇至旅途篇 · 家书与逃亡回响',
      condDesc: '爱丽丝积累「独立思考」或「执念依恋」倾向（≥2）',
      effectDesc: '爱丽丝在寒假花饼、霁馆夜思与亲笔来信中呈现截然不同的成长弧光，并将往昔承诺化作真实书信台词。'
    },
    noelle_arc: {
      id: 'noelle_arc',
      icon: bdIco('compass'),
      title: '精算之盟 · 手稿与勘误册',
      stage: '第五章至第十章 · 七座山与寒假辞别',
      condDesc: '诺艾儿积累「平等同盟」或「自尊防线」倾向（≥2）',
      effectDesc: '倾向平等同盟时诺艾儿在寒假前倾囊相授《省魔手稿》大幅提升魔力上限；倾向自尊防线时郑重奉还《精算勘误册》结清人情并稳固魔防。'
    },
    aino_arc: {
      id: 'aino_arc',
      icon: bdIco('snowflake'),
      title: '极北赠别 · 雪纹帕与钢冰笺',
      stage: '第八章 · 冰融之际毕业交接',
      condDesc: '艾诺积累「极北知己」或「严苛试炼」倾向（≥2）',
      effectDesc: '艾诺毕业返乡前在窗台留下专属信物：知己线赠予六瓣霜纹《雪纹手帕》相约寄雪，试炼线凝结无气泡《钢冰试炼笺》立下重逢第四局之约。'
    },
    northern_vow: {
      id: 'northern_vow',
      icon: bdIco('diamond'),
      title: '旧风与北境之契',
      stage: '第三卷 · 霁馆辞行与北风堡',
      condDesc: '点亮「院角老树」或「北极铃兰冰膜」，或积累霁岚关系倾向（≥2）',
      effectDesc: '解锁霁馆火腿粥夜话、乌木赠剑与紫蝶剑穗双轨誓言，踏上塞北官道并在北风堡凭恒温冰膜手艺护送药箱过关。'
    }
  };

  function createDefaultCausal() {
    return {
      version: 1,
      axes: {
        alice: { independence: 0, obsession: 0 },
        noelle: { partnership: 0, guarded_pride: 0 },
        charlotte: { candor: 0, rivalry: 0 },
        aino: { kinship: 0, austere_mentor: 0 },
        jilan: { hearth: 0, wanderlust: 0 }
      },
      clues: {
        bayi_banquet_leak: false,
        belmont_troop_shift: false,
        polar_lily_bond: false,
        wind_god_echo: false
      },
      echoes: [],
      vignettesDone: {},
      payoffsTriggered: {}
    };
  }

  function getStateObj() {
    if (typeof S !== 'undefined' && S) return S;
    if (root && root.S) return root.S;
    return null;
  }

  function ensureCausalState(targetS) {
    var st = targetS || getStateObj();
    if (!st) return createDefaultCausal();
    var def = createDefaultCausal();
    if (!st.causal || typeof st.causal !== 'object') {
      st.causal = def;
      return st.causal;
    }
    st.causal.version = 1;
    if (!st.causal.axes || typeof st.causal.axes !== 'object') st.causal.axes = {};
    Object.keys(def.axes).forEach(function (cid) {
      if (!st.causal.axes[cid] || typeof st.causal.axes[cid] !== 'object') {
        st.causal.axes[cid] = Object.assign({}, def.axes[cid]);
      } else {
        Object.keys(def.axes[cid]).forEach(function (k) {
          st.causal.axes[cid][k] = Number(st.causal.axes[cid][k] || 0);
        });
      }
    });
    if (!st.causal.clues || typeof st.causal.clues !== 'object') st.causal.clues = {};
    Object.keys(def.clues).forEach(function (ck) {
      st.causal.clues[ck] = !!st.causal.clues[ck];
    });
    if (!Array.isArray(st.causal.echoes)) st.causal.echoes = [];
    if (!st.causal.vignettesDone || typeof st.causal.vignettesDone !== 'object') st.causal.vignettesDone = {};
    if (!st.causal.payoffsTriggered || typeof st.causal.payoffsTriggered !== 'object') st.causal.payoffsTriggered = {};
    return st.causal;
  }

  function persistState() {
    try {
      if (typeof save === 'function') save();
    } catch (e) {}
  }

  /**
   * 为舞台立绘槽位同步可见的情绪角标与光晕（让单图立绘角色在主舞台也有鲜明 Galgame 神态演出）
   */
  function syncStageEmotionBadge(slotEl, charId, emotion) {
    if (!slotEl || typeof document === 'undefined') return;
    var emo = String(emotion || 'normal').trim();
    slotEl.setAttribute('data-emo', emo);
    var badge = slotEl.querySelector('.p-emo-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'p-emo-badge hidden';
      badge.setAttribute('aria-hidden', 'true');
      slotEl.appendChild(badge);
    }
    if (!charId || emo === 'normal' || !STAGE_EMO_BADGES[emo]) {
      badge.className = 'p-emo-badge hidden';
      badge.textContent = '';
      return;
    }
    badge.textContent = STAGE_EMO_BADGES[emo];
    badge.className = 'p-emo-badge emo-' + emo;
  }

  function showCausalRipple(text, kind) {
    if (typeof document === 'undefined') return;
    var host = document.getElementById('causal-ripple-stack');
    if (!host) {
      var gs = document.getElementById('game-screen') || document.body;
      if (!gs) return;
      host = document.createElement('div');
      host.id = 'causal-ripple-stack';
      host.className = 'causal-ripple-stack';
      gs.appendChild(host);
    }
    var item = document.createElement('div');
    item.className = 'causal-ripple ' + (kind || 'axis');
    item.textContent = text;
    host.appendChild(item);
    setTimeout(function () {
      item.classList.add('fade');
      setTimeout(function () { if (item.parentNode) item.parentNode.removeChild(item); }, 420);
    }, 2800);
  }

  function poleLabel(pole) {
    var cid = POLE_TO_CHAR[pole];
    if (!cid) return pole;
    var m = AXIS_META[cid];
    return m.leftKey === pole ? m.leftLabel : m.rightLabel;
  }

  /**
   * 调整双轴关系倾向
   */
  function shiftAxis(charOrPole, poleOrDelta, maybeDelta, opts) {
    var c = ensureCausalState();
    var cid = charOrPole;
    var pole = poleOrDelta;
    var delta = maybeDelta;
    var options = opts || {};

    if (typeof poleOrDelta === 'number') {
      pole = charOrPole;
      cid = POLE_TO_CHAR[pole];
      delta = poleOrDelta;
      options = maybeDelta || {};
    }
    if (!cid || !AXIS_META[cid]) cid = POLE_TO_CHAR[pole];
    if (!cid || !c.axes[cid] || typeof c.axes[cid][pole] !== 'number') return false;

    var d = Math.round(Number(delta) || 0);
    if (!d) return false;
    c.axes[cid][pole] = Math.max(0, Math.min(30, c.axes[cid][pole] + d));
    if (!options.silent) {
      showCausalRipple('◈ 命运暗流 · ' + AXIS_META[cid].name + '「' + poleLabel(pole) + '」' + (d > 0 ? '+' : '') + d, 'axis');
      persistState();
    }
    if (root.AIChatPanel && typeof root.AIChatPanel.refreshBadge === 'function') {
      root.AIChatPanel.refreshBadge();
    }
    return true;
  }

  /**
   * 解锁暗线情报拼图
   */
  function unlockClue(clueId, opts) {
    var options = opts || {};
    if (!CLUE_META[clueId]) return false;
    var c = ensureCausalState();
    if (c.clues[clueId]) return false;
    c.clues[clueId] = true;
    if (!options.silent) {
      showCausalRipple('✦ 暗线拼图点亮 · 《' + CLUE_META[clueId].title + '》', 'clue');
      persistState();
    }
    return true;
  }

  /**
   * 记录动态往昔回声（自动清洗违规词、按权重与时间保留 Top N）
   */
  function recordEcho(entry, opts) {
    var options = opts || {};
    if (!entry || !entry.quote) return false;
    var st = getStateObj();
    var c = ensureCausalState(st);
    var cleanQuote = String(entry.quote).trim().slice(0, 80);
    if (root.AI_PERSONAS && typeof root.AI_PERSONAS.sanitizeNarrativeOutput === 'function') {
      cleanQuote = root.AI_PERSONAS.sanitizeNarrativeOutput(cleanQuote);
    }
    if (!cleanQuote) return false;

    var id = entry.id || ('echo_' + (entry.charId || 'any') + '_' + cleanQuote.slice(0, 12));
    var item = {
      id: id,
      charId: entry.charId || '',
      speaker: entry.speaker || (entry.charId && typeof CHARS !== 'undefined' && CHARS[entry.charId] ? CHARS[entry.charId].short : '希尔维亚'),
      quote: cleanQuote,
      context: entry.context || ((st && typeof LOCS !== 'undefined' && LOCS[st.loc] ? LOCS[st.loc].name : '') || '日常交谈'),
      weight: Number(entry.weight || 2),
      year: st ? (st.year || st.ageY || 0) : 0,
      season: st ? (st.season || 0) : 0,
      seq: Date.now() + Math.random()
    };

    var existingIdx = c.echoes.findIndex(function (x) { return x.id === id || x.quote === cleanQuote; });
    if (existingIdx >= 0) {
      item.weight = Math.max(c.echoes[existingIdx].weight || 1, item.weight);
      c.echoes.splice(existingIdx, 1);
    }
    c.echoes.push(item);
    c.echoes.sort(function (a, b) {
      if ((b.weight || 0) !== (a.weight || 0)) return (b.weight || 0) - (a.weight || 0);
      return (b.seq || 0) - (a.seq || 0);
    });
    if (c.echoes.length > MAX_ECHOES) {
      c.echoes = c.echoes.slice(0, MAX_ECHOES);
    }

    if (!options.silent) {
      showCausalRipple('✦ 往昔回声已铭刻：「' + cleanQuote.slice(0, 18) + (cleanQuote.length > 18 ? '…' : '') + '」', 'echo');
      persistState();
    }
    return true;
  }

  function getEchoFor(charId, fallbackQuote) {
    var c = ensureCausalState();
    var hit = c.echoes.find(function (e) { return e.charId === charId; });
    return hit ? hit.quote : (fallbackQuote || '');
  }

  function getAxisSummary(charId, targetS) {
    var m = AXIS_META[charId];
    if (!m) return null;
    var c = ensureCausalState(targetS);
    var pair = c.axes[charId] || {};
    var lv = Number(pair[m.leftKey] || 0);
    var rv = Number(pair[m.rightKey] || 0);
    var total = lv + rv;
    var ratio = total === 0 ? 50 : Math.round(50 + ((rv - lv) / Math.max(4, total)) * 46);
    ratio = Math.max(4, Math.min(96, ratio));
    var dominant = lv === rv ? 'balanced' : (lv > rv ? m.leftKey : m.rightKey);
    var dominantLabel = dominant === 'balanced' ? '静水未分' : (dominant === m.leftKey ? m.leftLabel : m.rightLabel);
    return {
      charId: charId,
      name: m.name,
      icon: m.icon,
      leftKey: m.leftKey,
      leftLabel: m.leftLabel,
      leftVal: lv,
      leftDesc: m.leftDesc,
      rightKey: m.rightKey,
      rightLabel: m.rightLabel,
      rightVal: rv,
      rightDesc: m.rightDesc,
      ratio: ratio,
      dominant: dominant,
      dominantLabel: dominantLabel
    };
  }

  /**
   * 大主线蝴蝶效应判定器（全部 5 组关系双轴 + 4 枚线索全量闭环）
   */
  function countUnlockedClues(targetS) {
    var c = ensureCausalState(targetS);
    return Object.keys(c.clues).filter(function (k) { return !!c.clues[k]; }).length;
  }

  function canTriggerDarkTide(targetS) {
    var c = ensureCausalState(targetS);
    return (c.clues.bayi_banquet_leak && c.clues.belmont_troop_shift) || countUnlockedClues(targetS) >= 2;
  }

  function getCharlotteArcMode(targetS) {
    var c = ensureCausalState(targetS);
    var ch = c.axes.charlotte || { candor: 0, rivalry: 0 };
    if (ch.candor < 2 && ch.rivalry < 2) return 'default';
    return ch.candor > ch.rivalry ? 'candor' : 'rivalry';
  }

  function canTriggerRivalGrace(targetS) {
    return getCharlotteArcMode(targetS) === 'candor';
  }

  function getAliceArcMode(targetS) {
    var c = ensureCausalState(targetS);
    var al = c.axes.alice || { independence: 0, obsession: 0 };
    if (al.independence < 2 && al.obsession < 2) return 'default';
    return al.independence >= al.obsession ? 'independence' : 'obsession';
  }

  function getNoelleArcMode(targetS) {
    var c = ensureCausalState(targetS);
    var nl = c.axes.noelle || { partnership: 0, guarded_pride: 0 };
    if (nl.partnership < 2 && nl.guarded_pride < 2) return 'default';
    return nl.partnership >= nl.guarded_pride ? 'partnership' : 'guarded_pride';
  }

  function getAinoArcMode(targetS) {
    var c = ensureCausalState(targetS);
    var ai = c.axes.aino || { kinship: 0, austere_mentor: 0 };
    if (ai.kinship < 2 && ai.austere_mentor < 2) return 'default';
    return ai.kinship >= ai.austere_mentor ? 'kinship' : 'austere_mentor';
  }

  function canTriggerNorthernVow(targetS) {
    var c = ensureCausalState(targetS);
    var jl = c.axes.jilan || { hearth: 0, wanderlust: 0 };
    return !!c.clues.wind_god_echo || !!c.clues.polar_lily_bond || jl.hearth >= 2 || jl.wanderlust >= 2;
  }

  /**
   * 应用来自 AI 自由交谈（Gemini responseSchema 或酒馆尾注标签）的实时效果
   */
  function applyAIOutcome(charId, outcome, opts) {
    var options = opts || {};
    if (!outcome || typeof outcome !== 'object') return { applied: false };
    var st = getStateObj();
    ensureCausalState(st);

    var normalizedEmo = 'normal';
    if (root.AI_PERSONAS && typeof root.AI_PERSONAS.normalizeEmotion === 'function') {
      normalizedEmo = root.AI_PERSONAS.normalizeEmotion(charId, outcome.emotion);
    } else if (outcome.emotion) {
      normalizedEmo = String(outcome.emotion);
    }

    // 1. 实时同步舞台角色立绘表情与可视角标
    if (charId && typeof document !== 'undefined') {
      try {
        var updatedSlot = false;
        if (typeof stage !== 'undefined' && Array.isArray(stage) && stage.some(function (s) { return s.id === charId; })) {
          var nextStage = stage.map(function (s) {
            return {
              id: s.id,
              emo: s.id === charId ? normalizedEmo : (s.emo || 'normal'),
              active: s.id === charId
            };
          });
          if (typeof applyStage === 'function') {
            applyStage(nextStage);
            updatedSlot = true;
          }
        }
        if (!updatedSlot && typeof showPortrait === 'function') {
          var slots = ['p-left', 'p-center', 'p-right', 'p-fourth'];
          for (var i = 0; i < slots.length; i++) {
            var el = document.getElementById(slots[i]);
            if (el && !el.classList.contains('hidden') && el.getAttribute('data-char') === charId) {
              var slotName = slots[i].replace('p-', '');
              showPortrait(charId, normalizedEmo, slotName, true);
              syncStageEmotionBadge(el, charId, normalizedEmo);
              updatedSlot = true;
              break;
            }
          }
        }
        ['p-left', 'p-center', 'p-right', 'p-fourth'].forEach(function (sid) {
          var el = document.getElementById(sid);
          if (el && !el.classList.contains('hidden') && el.getAttribute('data-char') === charId) {
            syncStageEmotionBadge(el, charId, normalizedEmo);
          }
        });
      } catch (e) {}
    }

    // 2. 应用因果微调
    var deltas = outcome.causal_deltas || {};
    var axisChanged = false;
    var clueUnlocked = false;
    var echoSaved = false;

    if (deltas.axis && deltas.axis !== 'none' && POLE_TO_CHAR[deltas.axis]) {
      var targetChar = POLE_TO_CHAR[deltas.axis];
      if (!charId || targetChar === charId) {
        var safeDelta = Math.max(0, Math.min(2, Math.round(Number(deltas.delta) || 0)));
        if (safeDelta > 0) {
          axisChanged = shiftAxis(targetChar, deltas.axis, safeDelta, options);
        }
      }
    }

    if (deltas.clue && deltas.clue !== 'none' && CLUE_META[deltas.clue]) {
      var cm = CLUE_META[deltas.clue];
      var curPhase = (st && st.phase) || 'academy';
      var validCharMap = {
        bayi_banquet_leak: ['ajun', 'beatrice', 'claude', 'reno'],
        belmont_troop_shift: ['charlotte', 'helena', 'claude', 'reno', 'beatrice'],
        polar_lily_bond: ['aino', 'hol'],
        wind_god_echo: ['jilan', 'ji']
      };
      var okPhase = cm.allowedPhases.indexOf(curPhase) !== -1;
      var okChar = !charId || (validCharMap[deltas.clue] || []).indexOf(charId) !== -1;
      if (okPhase && okChar) {
        clueUnlocked = unlockClue(deltas.clue, options);
      }
    }

    if (outcome.memory_echo && String(outcome.memory_echo).trim().length >= 4) {
      echoSaved = recordEcho({
        charId: charId,
        quote: String(outcome.memory_echo).trim(),
        weight: 2
      }, options);
    }

    return {
      applied: true,
      emotion: normalizedEmo,
      axisChanged: axisChanged,
      clueUnlocked: clueUnlocked,
      echoSaved: echoSaved
    };
  }

  /**
   * 导出给外部/桥接的精简因果快照（绝对不含 SCENES / storyPending）
   */
  function getCausalSnapshot(targetS) {
    var c = ensureCausalState(targetS);
    return {
      axes: JSON.parse(JSON.stringify(c.axes)),
      clues: Object.assign({}, c.clues),
      echoes: c.echoes.slice(0, 4).map(function (e) {
        return { charId: e.charId, speaker: e.speaker, quote: e.quote };
      })
    };
  }

  // =========================================================================
  // 8 个高质感双幕双模「小场景（Micro-Vignettes）」定义与剧本注册
  // 热点坐标避开中心立绘（50%）与原有出口；第 1 幕灵魂交谈无缝衔入 _r2 第 2 幕！
  // =========================================================================

  var VIGNETTE_CATALOG = [
    {
      id: 'v_alice_shade',
      title: '夏荫陪坐与风的追问',
      charId: 'alice',
      icon: bdIco('leaf'),
      locs: ['study', 'garden'],
      x: 20, y: 28,
      canPlay: function (st) {
        return st.ageY >= 4 && st.ageY < 12 && !!(st.flags && st.flags.ch_alice_born) && !ensureCausalState(st).vignettesDone.v_alice_shade;
      }
    },
    {
      id: 'v_beatrice_practice',
      title: '练武场角落的木梳与微火',
      charId: 'beatrice',
      icon: bdIco('flame'),
      locs: ['training', 'dining'],
      x: 82, y: 28,
      canPlay: function (st) {
        return st.ageY >= 4 && st.ageY < 10 && !(st.flags && st.flags.ch_beatrice_leaves) && !ensureCausalState(st).vignettesDone.v_beatrice_practice;
      }
    },
    {
      id: 'v_noelle_clocktower',
      title: '手背日程表与钟塔橘猫',
      charId: 'noelle',
      icon: bdIco('cat'),
      locs: ['clocktower', 'library'],
      x: 18, y: 28,
      canPlay: function (st) {
        return st.phase === 'academy' && !!(st.flags && st.flags.met_noelle) && !ensureCausalState(st).vignettesDone.v_noelle_clocktower;
      }
    },
    {
      id: 'v_aino_flowerhouse',
      title: '北极铃兰与怕烫的咖喱',
      charId: 'aino',
      icon: bdIco('snowflake'),
      locs: ['flowerhouse', 'ice_class'],
      x: 18, y: 26,
      canPlay: function (st) {
        return st.phase === 'academy' && !!(st.flags && st.flags.met_aino) && !(st.flags && st.flags.ch_ice_melt_1) && !ensureCausalState(st).vignettesDone.v_aino_flowerhouse;
      }
    },
    {
      id: 'v_charlotte_memorial',
      title: '雨后纪念林的引水浅沟',
      charId: 'charlotte',
      icon: bdIco('leaf'),
      locs: ['memorial'],
      x: 82, y: 28,
      canPlay: function (st) {
        return st.phase === 'academy' && !!(st.flags && st.flags.met_charlotte) && !ensureCausalState(st).vignettesDone.v_charlotte_memorial;
      }
    },
    {
      id: 'v_helena_corridor',
      title: '日落长廊与星光信笺',
      charId: 'helena',
      icon: bdIco('sparkle'),
      locs: ['auditorium', 'water_class'],
      x: 82, y: 24,
      canPlay: function (st) {
        return st.phase === 'academy' && (!!(st.flags && st.flags.ch_helena) || st.year >= 13) && !ensureCausalState(st).vignettesDone.v_helena_corridor;
      }
    },
    {
      id: 'v_ajun_kitchen',
      title: '碎花围裙与小本子上的宴席',
      charId: 'ajun',
      icon: bdIco('bowl'),
      locs: ['cafeteria'],
      x: 82, y: 28,
      canPlay: function (st) {
        return st.phase === 'academy' && !!(st.flags && st.flags.met_ajun) && !ensureCausalState(st).vignettesDone.v_ajun_kitchen;
      }
    },
    {
      id: 'v_jilan_night',
      title: '霁馆夜廊与院角老树',
      charId: 'jilan',
      icon: bdIco('lantern'),
      locs: ['jikan'],
      x: 11, y: 23,
      canPlay: function (st) {
        return (st.phase === 'journey' || st.phase === 'finale') && !!(st.flags && st.flags.arrived_jikan) && !(st.flags && st.flags.ch_distant_wind_1) && !ensureCausalState(st).vignettesDone.v_jilan_night;
      }
    }
  ];

  function duoLine(leftArr, rightArr, speakerId, text, extra) {
    var aSpeak = speakerId === leftArr[0];
    return Object.assign({
      portraits: [
        { id: leftArr[0], slot: 'left', emo: leftArr[2] || 'normal', active: aSpeak },
        { id: rightArr[0], slot: 'right', emo: rightArr[2] || 'normal', active: !aSpeak }
      ],
      speaker: aSpeak ? leftArr[1] : rightArr[1],
      text: text
    }, extra || {});
  }

  function markVignetteDone(vId) {
    var c = ensureCausalState();
    c.vignettesDone[vId] = true;
    persistState();
  }

  /**
   * 在小场景中唤起 AI 自由输入推进：
   * - 舞台继续按钮与抽屉金色按钮统一走 AIChatPanel.finishActiveVignette()，绝不泄漏锁定或误覆写因果轴；
   * - 第 1 幕 (markDone:false) 收束后衔接进入 *_r2 第 2 幕；第 2 幕 (markDone:true) 完成回声铭刻并回归自由探索。
   */
  function launchVignetteFreeTalk(vId, charId, promptHint, fallbackPole, nextSteps, opts) {
    var options = opts || {};
    var shouldMarkDone = options.markDone !== false;
    var finalize = function (res) {
      if (!res || !res.axisChanged) {
        if (fallbackPole) shiftAxis(fallbackPole, 1);
      }
      if (typeof options.onBeforeFinish === 'function') {
        options.onBeforeFinish(res || null);
      }
      if (shouldMarkDone) markVignetteDone(vId);
      if (typeof playLines === 'function') playLines(nextSteps);
    };

    if (root.AIChatPanel && typeof root.AIChatPanel.openForVignette === 'function') {
      var completed = false;
      var finishOnce = function (res) {
        if (completed) return;
        completed = true;
        finalize(res);
      };
      if (typeof showChoices === 'function') {
        showChoices([{
          text: '✦ 已聊尽兴，继续推进本段剧情 ▸',
          do: function () {
            if (root.AIChatPanel && typeof root.AIChatPanel.finishActiveVignette === 'function') {
              root.AIChatPanel.finishActiveVignette();
            } else {
              if (root.AIChatPanel && typeof root.AIChatPanel.closeDrawer === 'function') root.AIChatPanel.closeDrawer();
              finishOnce(null);
            }
          }
        }]);
      }
      root.AIChatPanel.openForVignette({
        vignetteId: vId,
        charId: charId,
        hint: promptHint,
        onComplete: finishOnce
      });
      return;
    }
    finalize(null);
  }

  function buildVignetteScenes() {
    var VS = {};

    // 1) 童年书房/夏荫：爱丽丝的追问与发呆陪坐
    VS.v_alice_shade = {
      bgm: 'peaceful',
      bg: 'bg-img-study bg-study',
      loc: 'study',
      lines: [
        { text: '午后的图书室很静。高窗漏进来的夏日光斑铺在木地板上，连浮尘都慢悠悠的。', loc: 'study', bg: 'bg-img-study bg-study', portraits: [] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['alice', '爱丽丝', 'normal'], 'alice', '……姐姐大人。又在看窗外吗？'),
        { text: '爱丽丝抱着一本厚图谱坐到光斑边缘，手指在裙摆侧面轻轻收拢又松开。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'alice', slot: 'right', emo: 'shy', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['alice', '爱丽丝', 'shy'], 'alice', '姐姐大人发呆的时候，眼睛里很安静。……到底在看什么呢？'),
        {
          speaker: '希尔维亚',
          text: '（午后的风吹动窗边树影，要怎么回答爱丽丝？）',
          choices: [
            {
              text: '「在看风把树叶推往哪边。爱丽丝也闭上眼听听看？」',
              do: function () { shiftAxis('alice', 'independence', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['alice', '爱丽丝', 'normal'], 'sylvia', '在看风把高处的叶子推往哪边。你也闭上眼听听看？'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['alice', '爱丽丝', 'happy'], 'alice', '……左边那棵银杏叶响得密一些，院墙那头的风更凉。'),
                { goto: 'v_alice_shade_r2' }
              ]
            },
            {
              text: '「在等爱丽丝过来陪我坐着。再靠过来一点吧。」',
              do: function () { shiftAxis('alice', 'obsession', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['alice', '爱丽丝', 'shy'], 'sylvia', '其实什么也没想，就在等你过来陪我坐一会儿。再靠过来一点吧。'),
                { text: '她的睫毛轻轻颤了一下，默不作声地把小凳子挪到与我衣袖相贴的距离。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'alice', slot: 'right', emo: 'shy', active: false }] },
                { goto: 'v_alice_shade_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】用自己的话自由回应爱丽丝（AI 推进并进入下幕）',
              do: function () {
                launchVignetteFreeTalk('v_alice_shade', 'alice', '爱丽丝正坐在午后图书室光斑边问你发呆时在想什么', 'independence', [
                  duoLine(['sylvia', '希尔维亚', 'smile'], ['alice', '爱丽丝', 'happy'], 'alice', '……嗯。姐姐大人说的话，我都记在心里了。'),
                  { goto: 'v_alice_shade_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_alice_shade_r2 = {
      bgm: 'peaceful',
      bg: 'bg-img-study bg-study',
      loc: 'study',
      lines: [
        { text: '一阵穿堂风拂过书案，图谱里的干叶书签滑了出来，被爱丽丝伸手轻轻按住。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'alice', slot: 'right', emo: 'normal', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['alice', '爱丽丝', 'normal'], 'alice', '……姐姐大人。以后长大了，风也会把我们吹去很远的地方吗？'),
        {
          speaker: '希尔维亚',
          text: '（她低头看着那枚干叶书签，像在等一个能写进心底的答案。）',
          choices: [
            {
              text: '引导她：「学会自己驾驭风向，不管飞多远都能重逢。」',
              do: function () {
                shiftAxis('alice', 'independence', 2);
                recordEcho({ charId: 'alice', speaker: '希尔维亚', quote: '风往哪边吹由你自己去听，终会在高处重逢。', context: '图书室夏荫', weight: 3 });
                markVignetteDone('v_alice_shade');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['alice', '爱丽丝', 'normal'], 'sylvia', '风往哪边吹由你自己去听。只要学会驾驭风，无论去哪儿终会在高处重逢。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['alice', '爱丽丝', 'happy'], 'alice', '……嗯。那我要把风学得比谁都稳。'),
                { text: '她把那枚叶子端端正正夹进随身小本子里，眼底亮起一星清澈的光。', love: 'alice', loveD: 1, know: 'alice', knowD: 8, freeRoam: true }
              ]
            },
            {
              text: '揽住她：「那就一直留在我看得见的地方，哪儿也别去。」',
              do: function () {
                shiftAxis('alice', 'obsession', 2);
                recordEcho({ charId: 'alice', speaker: '希尔维亚', quote: '待在我看得见的地方就好，我的树荫永远留给你。', context: '图书室夏荫', weight: 3 });
                markVignetteDone('v_alice_shade');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['alice', '爱丽丝', 'shy'], 'sylvia', '待在我看得见的地方就好。不管外头风多大，我的树荫永远留给你。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['alice', '爱丽丝', 'shy'], 'alice', '……好。姐姐大人在哪里，我就在哪里。'),
                { text: '她轻轻抓紧我的袖角，把这句话一笔一画锁进了心底最深处。', love: 'alice', loveD: 1, know: 'alice', knowD: 8, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】亲自对爱丽丝许下关于风与未来的约定（AI 收束）',
              do: function () {
                launchVignetteFreeTalk('v_alice_shade', 'alice', '爱丽丝按住干叶书签，轻声问长大后风会不会把姐妹吹散', 'independence', [
                  duoLine(['sylvia', '希尔维亚', 'smile'], ['alice', '爱丽丝', 'happy'], 'alice', '……好。这枚干叶书签我夹好了，一言为定。'),
                  { text: '夏荫随着日头缓缓横移，妹妹翻书的沙沙声陪我度过了整个下午。', love: 'alice', loveD: 1, know: 'alice', knowD: 8, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'alice', speaker: '希尔维亚', quote: '风往哪边吹由你自己去听，终会在高处重逢。', context: '图书室夏荫', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // 2) 童年晚宴/训练场：贝阿特丽丝偷偷练习背后的心事
    VS.v_beatrice_practice = {
      bgm: 'emotional',
      bg: 'bg-img-training bg-plain',
      loc: 'training',
      lines: [
        { text: '晚宴散席后，练武场边缘的木桩后头透出一豆忽明忽暗的橘红微光。', loc: 'training', bg: 'bg-img-training bg-plain', portraits: [] },
        { text: '贝阿特丽丝蹲在沙地角落，屏息把火系魔力死死压在指尖，手边摆着一把齿尖微焦的木梳。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'beatrice', slot: 'right', emo: 'serious', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['beatrice', '贝阿特丽丝', 'surprised'], 'beatrice', '哇啊！！希尔维亚你走路怎么一点声音都没有！'),
        { text: '她手忙脚乱地把木梳往身后一藏，指腹上还留着反复控温憋出的红印。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'beatrice', slot: 'right', emo: 'normal', active: false }] },
        {
          speaker: '希尔维亚',
          text: '（姐姐藏在背后的手指还在微微发烫。）',
          choices: [
            {
              text: '凝一缕微凉水汽贴上她的指尖，安静等她开口',
              do: function () { if (typeof love === 'function') love('beatrice', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['beatrice', '贝阿特丽丝', 'normal'], 'sylvia', '手都烫红了。先凉一凉再藏吧。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['beatrice', '贝阿特丽丝', 'sad'], 'beatrice', '……好舒服。真是的，在妹妹面前完全耍不了帅嘛。'),
                { goto: 'v_beatrice_practice_r2' }
              ]
            },
            {
              text: '指了指那把微焦的木梳：「这也是贝阿特丽丝大人的新剑技？」',
              do: function () { if (typeof know === 'function') know('beatrice', 8); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'wink'], ['beatrice', '贝阿特丽丝', 'normal'], 'sylvia', '原来木梳也能拿来练剑技，长见识了。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['beatrice', '贝阿特丽丝', 'sad'], 'beatrice', '那叫精密控温测试啦！……算了，被你看见就看见吧。'),
                { goto: 'v_beatrice_practice_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】在练武场夜风里自由询问姐姐（AI 推进并进入下幕）',
              do: function () {
                launchVignetteFreeTalk('v_beatrice_practice', 'beatrice', '晚宴后你在练武场撞见偷偷拿木梳练微火控温的贝阿特丽丝', null, [
                  duoLine(['sylvia', '希尔维亚', 'normal'], ['beatrice', '贝阿特丽丝', 'sad'], 'beatrice', '……既然被你撞见了，跟你说实话也没关系。'),
                  { goto: 'v_beatrice_practice_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_beatrice_practice_r2 = {
      bgm: 'emotional',
      bg: 'bg-img-training bg-plain',
      loc: 'training',
      lines: [
        duoLine(['sylvia', '希尔维亚', 'normal'], ['beatrice', '贝阿特丽丝', 'serious'], 'beatrice', '今天晚宴前去书房送点心，听见父亲和管事提了一嘴，王都贝尔蒙家在边防人事上动作越来越大。'),
        duoLine(['sylvia', '希尔维亚', 'normal'], ['beatrice', '贝阿特丽丝', 'sad'], 'beatrice', '我想着，光会把人打飞根本护不住你们。连给爱丽丝梳头都会扯痛的话，哪算得上可靠的姐姐啊。'),
        {
          speaker: '希尔维亚',
          text: '（火光映在她认真的蓝眼睛里，平日的咋呼气全收了起来。）',
          choices: [
            {
              text: '把王都边防的异动暗记在心，约定三姐妹一起分担风雨',
              do: function () {
                if (typeof flag === 'function') flag('heard_duke_border_worry', 1);
                recordEcho({ charId: 'beatrice', speaker: '贝阿特丽丝', quote: '我要烧得够亮够稳，替你们把外头的风雨都挡在门外。', context: '练武场夜谈', weight: 3 });
                markVignetteDone('v_beatrice_practice');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'serious'], ['beatrice', '贝阿特丽丝', 'normal'], 'sylvia', '王都的事我记下了。真有起风的那天，我们三个一起站着，谁也别想一个人硬扛。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['beatrice', '贝阿特丽丝', 'normal'], 'beatrice', '哼哼，那当然！维斯特利亚三姐妹加在一起可是天下无敌的！'),
                { text: '她重新扬起下巴拍了拍胸口，眼底的阴霾散得干干净净。', love: 'beatrice', loveD: 1, know: 'beatrice', knowD: 8, freeRoam: true }
              ]
            },
            {
              text: '把额头凑过去让她拿木梳试手，夸她的温度刚刚好',
              do: function () {
                recordEcho({ charId: 'beatrice', speaker: '希尔维亚', quote: '姐姐掌心的温度刚刚好，一点也没有烫着。', context: '练武场夜谈', weight: 2 });
                markVignetteDone('v_beatrice_practice');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['beatrice', '贝阿特丽丝', 'surprised'], 'sylvia', '那先拿我的头发验收一下成果吧。'),
                { text: '她屏住气，温热的木梳顺着银灰发丝稳稳滑到底，没有勾住一根头发。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'beatrice', slot: 'right', emo: 'normal', active: false }] },
                duoLine(['sylvia', '希尔维亚', 'smile'], ['beatrice', '贝阿特丽丝', 'normal'], 'beatrice', '成、成功了！！明天早上我就去给爱丽丝梳！'),
                { text: '姐姐举着木梳欢呼着跑向走廊，笑声在夜色里传出去老远。', love: 'beatrice', loveD: 1, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】回应姐姐想守护全家的心事（AI 收束）',
              do: function () {
                if (typeof flag === 'function') flag('heard_duke_border_worry', 1);
                launchVignetteFreeTalk('v_beatrice_practice', 'beatrice', '贝阿特丽丝倾诉了父亲书房提到的王都边防压力，以及想保护妹妹的心意', null, [
                  duoLine(['sylvia', '希尔维亚', 'smile'], ['beatrice', '贝阿特丽丝', 'normal'], 'beatrice', '总之！有贝阿特丽丝大人在前面顶着，你和爱丽丝只管每天开开心心的就行！'),
                  { text: '夜风拂过木剑架，姐姐牵着我的手一道走回了灯火通明的长廊。', love: 'beatrice', loveD: 1, know: 'beatrice', knowD: 8, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'beatrice', speaker: '贝阿特丽丝', quote: '我要烧得够亮够稳，替你们把外头的风雨都挡在门外。', context: '练武场夜谈', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // 3) 学院钟塔喂猫：诺艾儿手背上的日程表与笨拙撸猫
    VS.v_noelle_clocktower = {
      bgm: 'relax',
      bg: 'bg-img-clocktower bg-school',
      loc: 'clocktower',
      lines: [
        { text: '钟塔顶层四面漏风，整座学院的灰瓦屋顶铺在脚下。台阶角落里缩着一个熟悉的身影。', loc: 'clocktower', bg: 'bg-img-clocktower bg-school', portraits: [] },
        { text: '诺艾儿左手背写着缩微日程表；一只圆滚滚的橘猫正拿脑袋蹭她小腿，她的右手僵在半空。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'noelle', slot: 'right', emo: 'normal', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'shy'], 'noelle', '……希尔维亚？你上来怎么也不敲一下门板。'),
        { text: '她条件反射抓起膝头那本厚砖般的《高阶构型分析》挡住半张脸——烫金书名正上下颠倒着。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'noelle', slot: 'right', emo: 'shy', active: false }] },
        {
          speaker: '希尔维亚',
          text: '（橘猫仰头喵了一声，诺艾儿的鼻尖被高处冷风吹得发红。）',
          choices: [
            {
              text: '装作没看见拿倒的书，悄然调转气流在她身周拢起一层暖意',
              do: function () { shiftAxis('noelle', 'partnership', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'normal'], 'sylvia', '图书馆有人嗑瓜子，我也上来躲个清静。顺手练一下控温，别浪费了。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'shy'], 'noelle', '……热量流向控制得挺准。既然来了，旁边的台阶分你一半。'),
                { goto: 'v_noelle_clocktower_r2' }
              ]
            },
            {
              text: '直接提醒她书拿反了，劝她天冷回宿舍别硬撑',
              do: function () { shiftAxis('noelle', 'guarded_pride', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'serious'], 'sylvia', '书拿倒了。风这么大，冻病了可没法去上课。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'serious'], 'noelle', '……我在看倒置阵图而已。这点冷风在乡下根本算不上什么，不用你操心。'),
                { goto: 'v_noelle_clocktower_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】在钟塔顶层与诺艾儿自由对话（AI 推进并进入下幕）',
              do: function () {
                launchVignetteFreeTalk('v_noelle_clocktower', 'noelle', '钟塔顶层诺艾儿正笨拙面对蹭腿的橘猫，左手背写满日程表，书还拿反了', 'partnership', [
                  duoLine(['sylvia', '希尔维亚', 'smile'], ['noelle', '诺艾儿', 'normal'], 'noelle', '……把书放平就放平吧。反正旁边的石阶空着，随便坐。'),
                  { goto: 'v_noelle_clocktower_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_noelle_clocktower_r2 = {
      bgm: 'relax',
      bg: 'bg-img-clocktower bg-school',
      loc: 'clocktower',
      lines: [
        { text: '橘猫跳上石阶吃着诺艾儿撕在纸角上的面包屑。她左手背末行写着：「省两成魔力路径·寄信给家里」。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'noelle', slot: 'right', emo: 'normal', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'normal'], 'noelle', '……它盯着我的手看，眼神像考官在判卷一样，根本不知道该从哪儿下手摸。'),
        {
          speaker: '希尔维亚',
          text: '（她手指悬在猫耳朵上方不远处，认真得像在拆解高阶术式。）',
          choices: [
            {
              text: '自然地把猫抱上她膝头示范顺毛，约她用省魔公式交换家里孤本',
              do: function () {
                shiftAxis('noelle', 'partnership', 2);
                recordEcho({ charId: 'noelle', speaker: '诺艾儿', quote: '用一杯水打赢一桶水的仗，这笔学术交易成交。', context: '钟塔喂猫', weight: 3 });
                markVignetteDone('v_noelle_clocktower');
              },
              lines: [
                { text: '我把橘猫捞起来放进她怀里，带着她的手背顺着脊背毛发轻轻抚过去。橘猫发出响亮的呼噜声。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'noelle', slot: 'right', emo: 'shy', active: false }] },
                duoLine(['sylvia', '希尔维亚', 'smile'], ['noelle', '诺艾儿', 'shy'], 'sylvia', '顺着毛就行。另外我书箱里有两本水系孤本，换你手背上那套省魔推导，很公平吧？'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['noelle', '诺艾儿', 'smile'], 'noelle', '……用一杯水打赢一桶水的仗。行，这笔交易成交，明早我把推导图带给你。'),
                { text: '诺艾儿紧绷的嘴角向上弯起极小的一点弧度，手指在猫背上慢慢变得柔和。', love: 'noelle', loveD: 1, know: 'noelle', knowD: 10, freeRoam: true }
              ]
            },
            {
              text: '把随身带的整盒黄油点心塞给她替她喂猫，嘱咐她多休息',
              do: function () {
                shiftAxis('noelle', 'guarded_pride', 2);
                recordEcho({ charId: 'noelle', speaker: '诺艾儿', quote: '记在左手背上的每一份人情，我都会凭本事还清。', context: '钟塔喂猫', weight: 2 });
                markVignetteDone('v_noelle_clocktower');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'serious'], 'sylvia', '这盒点心留给你和猫当下午茶吧，每天只睡四个小时迟早会垮的。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['noelle', '诺艾儿', 'serious'], 'noelle', '……维斯特利亚，说过别同情我。这盒点心我折算成下周期末重点勘误还你，一码归一码。'),
                { text: '她拿钢笔在左手背角落郑重添上一笔账目，才低头把点心碎屑分给了橘猫。', love: 'noelle', loveD: 1, know: 'noelle', knowD: 6, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】边陪她顺猫毛边聊聊手背上的省魔课题（AI 收束）',
              do: function () {
                launchVignetteFreeTalk('v_noelle_clocktower', 'noelle', '橘猫在石阶吃面包屑，诺艾儿不知怎么摸猫，手背上写着省两成魔力路径', 'partnership', [
                  duoLine(['sylvia', '希尔维亚', 'smile'], ['noelle', '诺艾儿', 'smile'], 'noelle', '……下次上来看书，带杯热水就行。这只猫大概也记住你了。'),
                  { text: '橘猫在石阶上打了个哈欠慢悠悠走远，翻书声重新和风声融在了一起。', love: 'noelle', loveD: 1, know: 'noelle', knowD: 10, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'noelle', speaker: '诺艾儿', quote: '用一杯水打赢一桶水的仗，这笔学术交易成交。', context: '钟塔喂猫', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // 4) 学院花坊午后：艾诺的北极铃兰与怕烫的咖喱
    VS.v_aino_flowerhouse = {
      bgm: 'peaceful',
      bg: 'bg-img-flowerhouse bg-garden',
      loc: 'flowerhouse',
      lines: [
        { text: '午后的校园花坊暖湿安静。角落里拢着一团淡蓝冰雾，艾诺正蹲在那盆北极铃兰前换水。', loc: 'flowerhouse', bg: 'bg-img-flowerhouse bg-garden', portraits: [] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'normal'], 'sylvia', '阿琼让我捎来的奶香咖喱，特意做成了温和口味。'),
        { text: '艾诺盯着冒白气的饭盒看了半晌，伸出食指凝出一缕冰蓝微光把热气压到温吞才舀起一口。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'aino', slot: 'right', emo: 'normal', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'shy'], 'aino', '……阿嚏。'),
        { text: '随着那声轻喷嚏，她头顶空气里噗地爆开一小圈真雪花落在银白发梢。她面无表情地捻掉：「……还行。」', portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'aino', slot: 'right', emo: 'shy', active: false }] },
        {
          speaker: '希尔维亚',
          text: '（原来极北之地长大的人，连舌头也是怕烫的。）',
          choices: [
            {
              text: '假装专心端详北极铃兰的花瓣，轻声问起赫兰入冬后的模样',
              do: function () { shiftAxis('aino', 'kinship', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'normal'], 'sylvia', '伊诺好像又多长出一片新叶了。赫兰现在的湖面已经冻上了吧？'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'smile'], 'aino', '……嗯。会冻成很深的靛蓝色，踩上去的声音和阿斯拉的薄冰完全两样。'),
                { goto: 'v_aino_flowerhouse_r2' }
              ]
            },
            {
              text: '递上手帕，向她讨教刚才压制咖喱热气的微量凝冰技巧',
              do: function () { shiftAxis('aino', 'austere_mentor', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'normal'], 'sylvia', '刚才那手只降温却零冰碴的控制，比实战凝盾还要难吧？'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'serious'], 'aino', '眼里总算有点门道了。战斗追求瞬间锁死，控温考的是持续均匀。'),
                { goto: 'v_aino_flowerhouse_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】在花坊冰雾旁自由与艾诺聊聊（AI 推进并进入下幕）',
              do: function () {
                launchVignetteFreeTalk('v_aino_flowerhouse', 'aino', '花坊午后艾诺刚吃完温吞咖喱打了个掉雪花的小喷嚏，身旁是北极铃兰伊诺', 'kinship', [
                  duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'normal'], 'aino', '……过来。趁现在手稳，给你看一样东西。'),
                  { goto: 'v_aino_flowerhouse_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_aino_flowerhouse_r2 = {
      bgm: 'peaceful',
      bg: 'bg-img-flowerhouse bg-garden',
      loc: 'flowerhouse',
      lines: [
        duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'normal'], 'aino', '下学期我毕业回赫兰。花坊整修时，这盆花会搬去冰系教室窗台。你来试着覆一层冰膜。'),
        { text: '她放慢动作在盆沿演示了一遍——魔力如薄纱般均匀垂落，盆底土层还留着清早有人悄悄铺过的冻土白霜。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'aino', slot: 'right', emo: 'normal', active: false }] },
        {
          speaker: '希尔维亚',
          text: '（往日她只点出差错从不亲手演示——眼前这一遍，是离开前郑重的预演。）',
          choices: [
            {
              text: '屏息凝出均匀柔和的恒温冰膜，接下替她守护“冬天的孩子”之约',
              do: function () {
                shiftAxis('aino', 'kinship', 2);
                unlockClue('polar_lily_bond');
                recordEcho({ charId: 'aino', speaker: '艾诺', quote: '冬天的孩子终会回到冬天，这层冰膜之后归你了。', context: '花坊托付', weight: 3 });
                markVignetteDone('v_aino_flowerhouse');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['aino', '艾诺', 'normal'], 'sylvia', '左下角我再补匀一点。等你在赫兰安顿好了，写信回来问我就行，保证冻不坏它。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['aino', '艾诺', 'smile'], 'aino', '……嗯。你的冰系够稳，交给你我放心。'),
                { text: '艾诺在窗边陪着那层冰膜静静坐了一下午，临走前连背影都柔和了几分。', love: 'aino', loveD: 1, know: 'aino', knowD: 12, freeRoam: true }
              ]
            },
            {
              text: '以无气泡钢冰稳住盆沿，约她离校前在训练场全力打满最后一场',
              do: function () {
                shiftAxis('aino', 'austere_mentor', 2);
                unlockClue('polar_lily_bond');
                recordEcho({ charId: 'aino', speaker: '艾诺', quote: '别让手里的冰生出气泡，下次见面让我看看你走了多远。', context: '花坊试手', weight: 3 });
                markVignetteDone('v_aino_flowerhouse');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'serious'], ['aino', '艾诺', 'serious'], 'sylvia', '冰膜我会每天换。作为交换，这个周六训练场别留手，我要堂堂正正打到三比三。'),
                duoLine(['sylvia', '希尔维亚', 'serious'], ['aino', '艾诺', 'smile'], 'aino', '口气不小。周六下午两点，迟到一秒就加练十组。'),
                { text: '冰蓝花瓣在薄雾中微闪，那份极寒控温的手感已彻底刻进指尖。', love: 'aino', loveD: 1, know: 'aino', knowD: 10, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】一边覆上恒温冰膜一边与艾诺立下约定（AI 收束）',
              do: function () {
                unlockClue('polar_lily_bond');
                launchVignetteFreeTalk('v_aino_flowerhouse', 'aino', '艾诺亲手演示了北极铃兰的恒温冰膜，即将毕业回赫兰前将花交接给你', 'kinship', [
                  duoLine(['sylvia', '希尔维亚', 'normal'], ['aino', '艾诺', 'smile'], 'aino', '……冰膜成型得不错。之后就归你练手了。'),
                  { text: '北极铃兰在淡蓝薄雾里轻轻颤动，像是记住了掌心渗出的温度。', love: 'aino', loveD: 1, know: 'aino', knowD: 12, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'aino', speaker: '艾诺', quote: '冬天的孩子终会回到冬天，这层冰膜之后归你了。', context: '花坊托付', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // 5) 学院纪念林雨后：夏洛特给母亲旧树挖的排水沟
    VS.v_charlotte_memorial = {
      bgm: 'emotional',
      bg: 'bg-img-memorial bg-garden',
      loc: 'memorial',
      lines: [
        { text: '阵雨初歇的纪念林弥漫着湿润泥土气息。刻着「—mond」残字的旧木牌下蹲着一个人影。', loc: 'memorial', bg: 'bg-img-memorial bg-garden', portraits: [] },
        { text: '夏洛特没带侍女，深灰旧外套袖口卷到肘部，正拿小铁铲在两棵树之间挖出一道引水浅沟。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'charlotte', slot: 'right', emo: 'surprised', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'shy'], 'charlotte', '维斯特利亚？！你来林子里怎么连点脚步声都没有！'),
        { text: '她慌忙站起身拍掉手上的泥，咔哒一声合上折扇把下巴抬高，耳根却泛起一层薄红。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'charlotte', slot: 'right', emo: 'shy', active: false }] },
        {
          speaker: '希尔维亚',
          text: '（积水正顺着她刚挖好的浅沟绕开两边树根流向低处。）',
          choices: [
            {
              text: '不戳破她的窘迫，凝出一片薄冰刃顺手帮她把沟沿泥壁加固平整',
              do: function () { shiftAxis('charlotte', 'candor', 2); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'normal'], 'sylvia', '这道坡度留得很专业。后半截泥土有点松，我用冰压实一下免得雨水冲塌。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'shy'], 'charlotte', '……算你还有点眼力。记住，只是怕你的树苗烂根倒过来碍着这边的树。'),
                { goto: 'v_charlotte_memorial_r2' }
              ]
            },
            {
              text: '抱臂挑眉：「贝尔蒙家连挖水沟都要争第一，期末考核我更得全力应战了。」',
              do: function () { shiftAxis('charlotte', 'rivalry', 2); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'wink'], ['charlotte', '夏洛特', 'serious'], 'sylvia', '连护树都这么一丝不苟，看来期末榜单的赌约我得再认真几分了。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'normal'], 'charlotte', '哼，那还用说！上次那张羊皮字据我迟早亲手赢回来！'),
                { goto: 'v_charlotte_memorial_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】在雨后纪念林与夏洛特自由交锋（AI 推进并进入下幕）',
              do: function () {
                launchVignetteFreeTalk('v_charlotte_memorial', 'charlotte', '雨后纪念林夏洛特刚给两棵树挖好排水沟，耳根泛红端着架子', 'candor', [
                  duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'normal'], 'charlotte', '……哼，既然没有旁人在场，站在树底下歇口气也无妨。'),
                  { goto: 'v_charlotte_memorial_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_charlotte_memorial_r2 = {
      bgm: 'emotional',
      bg: 'bg-img-memorial bg-garden',
      loc: 'memorial',
      lines: [
        { text: '林梢滴下几颗残雨。夏洛特望向远处王都灰蒙蒙的城墙轮廓，握着折扇的指节微微收紧。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'charlotte', slot: 'right', emo: 'sad', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'serious'], 'charlotte', '最近家里的外务管事忙得脚不沾地，连东郊几处庄园的私军轮值都换了生面孔……王都今年冬天的风向，让人心里烦得很。'),
        {
          speaker: '希尔维亚',
          text: '（王后母族贝尔蒙家私军换防的细节从她话音里漏出一角。）',
          choices: [
            {
              text: '将东郊调防暗记于心，认真告诉她：「这棵树被照顾得很好，无关两家姓氏。」',
              do: function () {
                shiftAxis('charlotte', 'candor', 2);
                unlockClue('belmont_troop_shift');
                recordEcho({ charId: 'charlotte', speaker: '夏洛特', quote: '贝尔蒙家从不欠人情，树影底下说的话只限于你我知晓。', context: '纪念林浅沟', weight: 3 });
                markVignetteDone('v_charlotte_memorial');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'normal'], 'sylvia', '王庭里的风向归大人们去吵。至少在这片林子里，这棵树活得很好，这就够了。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'shy'], 'charlotte', '……少多管闲事，维斯特利亚。贝尔蒙家从不欠人情，今天的话出了林子谁也别提。'),
                { text: '她别过脸快步走上碎石小径，那道引水浅沟在微光里清清楚楚地护住了两边的根系。', love: 'charlotte', loveD: 1, know: 'charlotte', knowD: 12, freeRoam: true }
              ]
            },
            {
              text: '扬眉应战：「管外面风向怎么变，考场上我可绝不给你留情面。」',
              do: function () {
                shiftAxis('charlotte', 'rivalry', 2);
                unlockClue('belmont_troop_shift');
                recordEcho({ charId: 'charlotte', speaker: '夏洛特', quote: '除了我夏洛特·贝尔蒙，谁也没资格赢过你。', context: '纪念林约战', weight: 2 });
                markVignetteDone('v_charlotte_memorial');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['charlotte', '夏洛特', 'normal'], 'sylvia', '外面的事轮不到我们操心。倒是期末实战考核，你可得把心思收回来应战。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['charlotte', '夏洛特', 'normal'], 'charlotte', '正合我意！听好了维斯特利亚，在这所学院里，除了我谁也没资格压你一头！'),
                { text: '金发少女恢复了平日昂首挺胸的气派，踩着积水干脆利落地走远了。', love: 'charlotte', loveD: 1, know: 'charlotte', knowD: 8, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】就王都风向与林中默契自由回应夏洛特（AI 收束）',
              do: function () {
                unlockClue('belmont_troop_shift');
                launchVignetteFreeTalk('v_charlotte_memorial', 'charlotte', '夏洛特在雨后林间无意透露了贝尔蒙外务管事调换东郊私军轮值的烦闷', 'candor', [
                  duoLine(['sylvia', '希尔维亚', 'normal'], ['charlotte', '夏洛特', 'shy'], 'charlotte', '……行了，雨停透了就早点回教学楼，别让人看见我们俩待在一块儿。'),
                  { text: '夏洛特拎起小铁铲转身离开，走过拐角前脚步比平时慢了半拍。', love: 'charlotte', loveD: 1, know: 'charlotte', knowD: 12, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'charlotte', speaker: '夏洛特', quote: '贝尔蒙家从不欠人情，树影底下说的话只限于你我知晓。', context: '纪念林浅沟', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // 6) 学院日落长廊：海伦娜的神殿心事与信笺约定
    VS.v_helena_corridor = {
      bgm: 'romantic',
      bg: 'bg-img-auditorium bg-hall',
      loc: 'auditorium',
      lines: [
        { text: '傍晚的礼堂外廊被落日染成一片暖橙色。海伦娜趴在石栏边看远山，金发在晚风里轻晃。', loc: 'auditorium', bg: 'bg-img-auditorium bg-hall', portraits: [] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['helena', '海伦娜', 'smile'], 'helena', '希尔维亚！你看西边的云，像刚出炉的蜂蜜面包一样暖融融的！'),
        { text: '提到即将回希里昂神圣国复命时，她嘴角的弧度淡了一格，十指在白色神官袖口边绞在一起。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'helena', slot: 'right', emo: 'sad', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['helena', '海伦娜', 'sad'], 'helena', '使团领队催大家提前整装，说阿斯拉边境驿站盘查突然变严了……一想到回去又要背神殿仪轨，心里就有点闷呢。'),
        {
          speaker: '希尔维亚',
          text: '（晚霞映在她垂下的绿眸里，难得卸下了小太阳般的坚强。）',
          choices: [
            {
              text: '在掌心凝出一朵六瓣冰花送给她，约她在信里只写开心的琐事',
              do: function () { if (typeof love === 'function') love('helena', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['helena', '海伦娜', 'happy'], 'sylvia', '拿着凉快一下吧。回去以后要是觉得神殿太闷，写信时只写今天吃了什么就行。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['helena', '海伦娜', 'happy'], 'helena', '真的可以吗？！好漂亮……我要一直捧在手心里看着它化掉！'),
                { goto: 'v_helena_corridor_r2' }
              ]
            },
            {
              text: '仔细询问使团领队提到的边境驿站盘查异动，提醒她路上留神',
              do: function () { unlockClue('belmont_troop_shift'); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'serious'], ['helena', '海伦娜', 'normal'], 'sylvia', '往年秋冬季节驿站很少严查交换生车队。领队有说是哪边派来的人手吗？'),
                duoLine(['sylvia', '希尔维亚', 'serious'], ['helena', '海伦娜', 'normal'], 'helena', '听说是王都外务新换的巡防官，连外交文牒都要核验两遍呢。我会跟紧队伍小心的！'),
                { goto: 'v_helena_corridor_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】在日落长廊宽慰海伦娜并询问盘查（AI 推进并进入下幕）',
              do: function () {
                unlockClue('belmont_troop_shift');
                launchVignetteFreeTalk('v_helena_corridor', 'helena', '日落长廊上海伦娜聊起回神殿的压力与边境盘查变严的心事', null, [
                  duoLine(['sylvia', '希尔维亚', 'smile'], ['helena', '海伦娜', 'happy'], 'helena', '被希尔维亚一劝，胸口一下子敞亮多啦！对了，还有样东西要给你！'),
                  { goto: 'v_helena_corridor_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_helena_corridor_r2 = {
      bgm: 'romantic',
      bg: 'bg-img-auditorium bg-hall',
      loc: 'auditorium',
      lines: [
        { text: '海伦娜眼里的暖灯重新亮了起来，从袖袋摸出一张折得整整齐齐的信纸推到我手边，角落画着三颗并排的小星星。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'helena', slot: 'right', emo: 'happy', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['helena', '海伦娜', 'happy'], 'helena', '这是希里昂神殿的通讯地址！哪怕隔着好几座山，只要看到你的字迹，我就能立刻充满干劲！'),
        {
          speaker: '希尔维亚',
          text: '（她双手合十望着我，金发镀着最后一抹暮光。）',
          choices: [
            {
              text: '郑重收好星光信笺：「不管以后走到哪里，看到星星就会给你报平安。」',
              do: function () {
                recordEcho({ charId: 'helena', speaker: '海伦娜', quote: '希里昂的雪若太冷，就在信纸末尾多画一颗星星报平安。', context: '日落长廊之约', weight: 3 });
                markVignetteDone('v_helena_corridor');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'smile'], ['helena', '海伦娜', 'happy'], 'sylvia', '收好了。以后无论在哪座城市落脚，只要驿路还通，就给你寄信。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['helena', '海伦娜', 'wink'], 'helena', '嗯！！我会把每一封都夹进经文册最里层的！'),
                { text: '她欢快地挥手转身，差点又踩到长袍下摆，稳住身形后回头冲我吐了吐舌头。', love: 'helena', loveD: 1, know: 'helena', knowD: 10, freeRoam: true }
              ]
            },
            {
              text: '替她理好差点绊脚的白色袍角：「神官大人先练好平地走路，别再磕着后脑勺了。」',
              do: function () {
                recordEcho({ charId: 'helena', speaker: '希尔维亚', quote: '少背一点沉重的规矩，走路记得看脚下的台阶。', context: '日落长廊叮嘱', weight: 2 });
                markVignetteDone('v_helena_corridor');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'wink'], ['helena', '海伦娜', 'shy'], 'sylvia', '比起担心辜负神明，先当心脚下的石阶吧，回去可没人拿冰手掌给你敷肿包了。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['helena', '海伦娜', 'happy'], 'helena', '唔……那次纯属意外嘛！我会连希尔维亚那份自在也一起带回去好好生活的！'),
                { text: '暮色漫上长廊，那张画着三颗星星的纸笺在衣袋里留下一抹温和暖意。', love: 'helena', loveD: 1, know: 'helena', knowD: 8, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】收下三颗星星地址笺并与海伦娜约定书信（AI 收束）',
              do: function () {
                launchVignetteFreeTalk('v_helena_corridor', 'helena', '海伦娜把画着三颗小星星的希里昂神殿通讯地址交给你，期盼以后通信', null, [
                  duoLine(['sylvia', '希尔维亚', 'smile'], ['helena', '海伦娜', 'wink'], 'helena', '约好了哦！每封信末尾我都会画上笑脸和星星，希尔维亚一定要按时吃饭！'),
                  { text: '晚霞沉入山脊，衣袋里多了一张画着金色小星星的信笺。', love: 'helena', loveD: 1, know: 'helena', knowD: 10, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'helena', speaker: '海伦娜', quote: '希里昂的雪若太冷，就在信纸末尾多画一颗星星报平安。', context: '日落长廊之约', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // 7) 学院公共厨房：阿琼记在小本子上的公爵府宴会食谱（核心警觉暗线！）
    VS.v_ajun_kitchen = {
      bgm: 'academy',
      bg: 'bg-img-cafeteria bg-hall',
      loc: 'cafeteria',
      lines: [
        { text: '周末的食堂公共厨房飘满浓郁的藏红花与椰浆香气。阿琼系着粉红碎花围裙站在三口锅前忙得热火朝天。', loc: 'cafeteria', bg: 'bg-img-cafeteria bg-hall', portraits: [] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['ajun', '阿琼', 'happy'], 'ajun', '希尔维亚！来得正好！这锅甜汤帕亚萨刚收好汁，我还顺手把给我表叔回信的笔记整理好啦！'),
        { text: '他掏出随身小本子翻开——食谱底下赫然记着「维斯特利亚府银杏露、三代王室纹章银杯、东侧客房与夜巡换班时间」。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'ajun', slot: 'right', emo: 'happy', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['ajun', '阿琼', 'normal'], 'ajun', '表叔在使团随行当差，来信说想研究各地起居对药物适配的影响，连银杯纹章和客房朝向都问得可细啦！'),
        {
          speaker: '希尔维亚',
          text: '（研究药物适配，为什么会问到王室纹章银杯、客房朝向与夜巡换班？）',
          choices: [
            {
              text: '【暗流警觉】借翻看食谱细看那几条问题，追问是谁托他表叔打听这些细节',
              do: function () { if (typeof know === 'function') know('ajun', 8); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'serious'], ['ajun', '阿琼', 'surprised'], 'sylvia', '阿琼，药效适配通常只看香料和水土吧？银杯底下的旧纹章和客房换班，也是你表叔自己想问的？'),
                duoLine(['sylvia', '希尔维亚', 'serious'], ['ajun', '阿琼', 'normal'], 'ajun', '咦……经你一提醒还真是！表叔信里提了一嘴，说是使团里有位和王都贵族走得近的礼宾官顺口托他打听的！'),
                { goto: 'v_ajun_kitchen_r2' }
              ]
            },
            {
              text: '先尝一勺温热的帕亚萨，顺手拦住他差点撒进甜汤里的盐勺',
              do: function () { if (typeof love === 'function') love('ajun', 1); },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['ajun', '阿琼', 'surprised'], 'sylvia', '左边那罐是粗盐，再撒下去甜汤又要欠我一条命了。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['ajun', '阿琼', 'happy'], 'ajun', '哇啊好险！！谢谢希尔维亚救命之恩！'),
                { goto: 'v_ajun_kitchen_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】就小本子上的反常记录直接询问阿琼（AI 推进并进入下幕）',
              do: function () {
                launchVignetteFreeTalk('v_ajun_kitchen', 'ajun', '公共厨房里阿琼的小本子上记着使团表叔转问的公爵府银杯纹章与客房换班细节', null, [
                  duoLine(['sylvia', '希尔维亚', 'serious'], ['ajun', '阿琼', 'surprised'], 'ajun', '啊，说到这个，信纸背面好像还有一句附言呢！'),
                  { goto: 'v_ajun_kitchen_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_ajun_kitchen_r2 = {
      bgm: 'academy',
      bg: 'bg-img-cafeteria bg-hall',
      loc: 'cafeteria',
      lines: [
        { text: '锅里的甜汤咕嘟冒泡。阿琼握着短铅笔眨了眨眼，脸上全是毫无城府的坦率。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'ajun', slot: 'right', emo: 'normal', active: false }] },
        duoLine(['sylvia', '希尔维亚', 'normal'], ['ajun', '阿琼', 'normal'], 'ajun', '那位礼宾官还问冬假使团去公爵府做客时走哪道侧门方便呢……希尔维亚，这里头该不会有什么忌讳吧？'),
        {
          bgm: 'suspense',
          speaker: '希尔维亚',
          text: '（巴依使团冬假访府、旧纹章银杯、侧门与换班……有人正借使团之手拼凑公爵府的布防图！）',
          choices: [
            {
              text: '温和提醒阿琼划掉宅邸动线只寄食谱，将「巴依使团眼线」记入冰晶宫殿',
              do: function () {
                unlockClue('bayi_banquet_leak');
                if (typeof S !== 'undefined' && S.stats) S.stats.mind = Math.min(100, (S.stats.mind || 15) + 2);
                recordEcho({ charId: 'ajun', speaker: '希尔维亚', quote: '小本子上只留热乎的咖喱与甜汤方子就好，宅邸门径别往外写。', context: '公共厨房暗流', weight: 3 });
                markVignetteDone('v_ajun_kitchen');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'serious'], ['ajun', '阿琼', 'normal'], 'sylvia', '就像你祖母严守独门香料配比一样，各家宅院的门径换班也有规矩。回信只写甜汤就够了，其余划掉吧。'),
                duoLine(['sylvia', '希尔维亚', 'normal'], ['ajun', '阿琼', 'happy'], 'ajun', '用祖传配方一比喻我就全明白啦！我这就擦干净！来来来，这罐红叶茶你带回寝室热着喝！'),
                { text: '接过微烫的茶罐，我在意识深处将「使团礼宾官暗探公爵府」这一页彻底冻结存档。', love: 'ajun', loveD: 1, know: 'ajun', knowD: 12, freeRoam: true }
              ]
            },
            {
              text: '不动声色收下他装好的甜汤与红叶茶，嘱咐他以后少替陌生官员传话',
              do: function () {
                recordEcho({ charId: 'ajun', speaker: '阿琼', quote: '人在异乡的时候，吃上一口热乎饭总能少想一点家。', context: '公共厨房聚餐', weight: 2 });
                markVignetteDone('v_ajun_kitchen');
              },
              lines: [
                duoLine(['sylvia', '希尔维亚', 'normal'], ['ajun', '阿琼', 'happy'], 'sylvia', '陌生的官员托打听的事，敷衍过去就行。先把你这锅快熬干的帕亚萨盛出来吧。'),
                duoLine(['sylvia', '希尔维亚', 'smile'], ['ajun', '阿琼', 'happy'], 'ajun', '好嘞！听朋友的准没错！记得趁热喝，冷风天千万别伤了胃啊！'),
                { text: '浓郁的椰奶甜香驱散了深秋寒意，厨房外渐渐热闹起来。', love: 'ajun', loveD: 1, know: 'ajun', knowD: 8, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】叮嘱阿琼涂掉侧门记录并锁定使团暗探线索（AI 收束）',
              do: function () {
                unlockClue('bayi_banquet_leak');
                launchVignetteFreeTalk('v_ajun_kitchen', 'ajun', '使团礼宾官借阿琼表叔打听公爵府冬假侧门与夜巡，请温和提醒单纯的阿琼涂掉宅邸记录', null, [
                  duoLine(['sylvia', '希尔维亚', 'serious'], ['ajun', '阿琼', 'happy'], 'ajun', '懂啦懂啦！别人家的私密布局就像独门香料罐一样绝不外传，我这就把后面那几行涂黑！'),
                  { text: '阿琼老老实实涂掉了宅邸细节，而那缕伸向公爵府的暗流已被我锁进心底。', love: 'ajun', loveD: 1, know: 'ajun', knowD: 12, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'ajun', speaker: '希尔维亚', quote: '小本子上只留热乎的咖喱与甜汤方子就好，宅邸门径别往外写。', context: '公共厨房暗流', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // 8) 澄岚霁馆夜廊：霁岚讲述院角老树与从未谋面的母亲
    VS.v_jilan_night = {
      bgm: 'relax',
      bg: 'bg-img-jikan bg-room',
      loc: 'jikan',
      lines: [
        { text: '澄岚镇的冬夜干冷清透。月光铺在霁馆空旷的砂地练习场上，留着白天三个人踩出的浅脚印。', loc: 'jikan', bg: 'bg-img-jikan bg-room', portraits: [] },
        { text: '楼下院角那棵修剪得异常整齐的老树前，霁馆主拎着纸灯笼站了一阵才回屋。二楼木廊边，霁岚抱膝坐着。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'jilan', slot: 'right', emo: 'normal', active: false }] },
        duoLine(['sylvia', '渔', 'normal'], ['jilan', '霁岚', 'shy'], 'jilan', '……渔，你也还没睡呀。刚才楼下那棵树，你也看见我爸过去了吧？'),
        duoLine(['sylvia', '渔', 'normal'], ['jilan', '霁岚', 'sad'], 'jilan', '我爸做饭糊得一塌糊涂，偏偏修那棵树比谁都细心。他说那是我妈当年种下的，连「岚」这个名也是她留纸条起的。'),
        {
          speaker: '渔',
          text: '（夜风吹动她发间亮紫色的蝴蝶发饰，白日里两倍速的大嗓门轻得像叹息。）',
          choices: [
            {
              text: '挨着她在木廊坐下：「这座院子有霁叔的粥和你的木桩声，很暖和。」',
              do: function () {
                shiftAxis('jilan', 'hearth', 1);
                unlockClue('wind_god_echo');
              },
              lines: [
                duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'shy'], 'sylvia', '树有人天天照看，说明留下它的人一直被记着。有你和霁叔在，这座院子比外头暖和多了。'),
                duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'happy'], 'jilan', '……嘿嘿，你今天说话比平时好听多了！可惜我爸炒的菜实在配不上这话！'),
                { goto: 'v_jilan_night_r2' }
              ]
            },
            {
              text: '望向北方夜空：「叫『岚』的人大概生来属于高处的风。你以后也想出去看看吗？」',
              do: function () {
                shiftAxis('jilan', 'wanderlust', 1);
                unlockClue('wind_god_echo');
              },
              lines: [
                duoLine(['sylvia', '渔', 'normal'], ['jilan', '霁岚', 'normal'], 'sylvia', '苏秦文字里，「岚」是山间的风吧。有朝一日，你也想提着真剑去外面的天地走一遭吗？'),
                duoLine(['sylvia', '渔', 'normal'], ['jilan', '霁岚', 'happy'], 'jilan', '想过呀！每次听公会里走南闯北的冒险者聊起大雪原和边关，我的手心都跟着发痒呢！'),
                { goto: 'v_jilan_night_r2' }
              ]
            },
            {
              text: '✦【灵魂交谈】以「渔」的身份在夜廊与霁岚交心（AI 推进并进入下幕）',
              do: function () {
                unlockClue('wind_god_echo');
                launchVignetteFreeTalk('v_jilan_night', 'jilan', '澄岚冬夜二楼木廊，霁岚对着院角老树与黑发少女「渔」聊起母亲留下的名字', 'hearth', [
                  duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'normal'], 'jilan', '……对了渔，趁这会儿月亮亮，给你看样我编了好几晚的东西。'),
                  { goto: 'v_jilan_night_r2' }
                ], { markDone: false });
              }
            }
          ]
        }
      ]
    };

    VS.v_jilan_night_r2 = {
      bgm: 'relax',
      bg: 'bg-img-jikan bg-room',
      loc: 'jikan',
      lines: [
        { text: '霁岚从练功衫口袋摸出一缕编了一半的紫色丝绦，指腹摩挲着丝线结头，抬头望向黑发墨绿眼的我。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'jilan', slot: 'right', emo: 'normal', active: false }] },
        duoLine(['sylvia', '渔', 'normal'], ['jilan', '霁岚', 'normal'], 'jilan', '渔，我爸说你练剑的劲头藏着远路，开春以后多半留不住你。……等去了别的地方，你还会记得澄岚这家小剑馆吗？'),
        {
          speaker: '渔',
          text: '（走廊门框上旧名牌留下的钉孔在月光下清晰可见。）',
          choices: [
            {
              text: '许下归处之约：「只要霁馆的灯还亮着，走再远我也会回来喝粥。」',
              do: function () {
                shiftAxis('jilan', 'hearth', 2);
                recordEcho({ charId: 'jilan', speaker: '渔', quote: '只要霁馆的灯还亮着，走再远我也会回来喝这碗热粥。', context: '霁馆夜廊', weight: 3 });
                markVignetteDone('v_jilan_night');
              },
              lines: [
                duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'happy'], 'sylvia', '三枚铜币住这么好的院子，哪有忘掉的道理。只要霁馆的灯还亮着，走再远我也会回来喝粥。'),
                duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'happy'], 'jilan', '说定了啊！木架第三排左边第四个位置我永远给你空着，谁来也不许乱挂！'),
                { text: '紫蝴蝶在月光下欢快地翘了翘，寒夜里的木廊暖意融融。', love: 'jilan', loveD: 1, know: 'jilan', knowD: 12, freeRoam: true }
              ]
            },
            {
              text: '立下剑客之约：「等这枚紫穗编好，让它陪我去北边见识风雪，重逢再比一场。」',
              do: function () {
                shiftAxis('jilan', 'wanderlust', 2);
                recordEcho({ charId: 'jilan', speaker: '霁岚', quote: '紫蝶剑穗先替我去见见塞北风雪，重逢时我们在剑下见真章。', context: '霁馆夜廊', weight: 3 });
                markVignetteDone('v_jilan_night');
              },
              lines: [
                duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'normal'], 'sylvia', '等你手里这条紫色剑穗编好了，我带着它去北边见识风雪。下次见面，我们拿真剑堂堂正正比一场。'),
                duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'happy'], 'jilan', '一言为定！那我这几天可得抓紧编紧实些，省得被你半路挥断了！'),
                { text: '夜风拂过院角修剪整齐的老树，带着远方冻土与自由的气息。', love: 'jilan', loveD: 1, know: 'jilan', knowD: 12, freeRoam: true }
              ]
            },
            {
              text: '✦【灵魂交谈】对着半编好的紫色剑穗与霁岚定下重逢之约（AI 收束）',
              do: function () {
                launchVignetteFreeTalk('v_jilan_night', 'jilan', '霁岚攥着编了一半的紫色剑穗，问「渔」开春远行后还会不会记得霁馆', 'hearth', [
                  duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'happy'], 'jilan', '好啦夜里风硬，快回屋钻被窝吧！明早第三排第四把竹剑还等着你呢！'),
                  { text: '院角老树的枝影在月色下轻轻摇晃，仿佛有一缕极远的风掠过灰瓦屋檐。', love: 'jilan', loveD: 1, know: 'jilan', knowD: 12, freeRoam: true }
                ], {
                  markDone: true,
                  onBeforeFinish: function (res) {
                    if (!res || !res.echoSaved) {
                      recordEcho({ charId: 'jilan', speaker: '渔', quote: '只要霁馆的灯还亮着，走再远我也会回来喝这碗热粥。', context: '霁馆夜廊', weight: 3 });
                    }
                  }
                });
              }
            }
          ]
        }
      ]
    };

    // =========================================================================
    // 第三卷压轴完整主线收束章：霁馆辞行 · 乌木紫穗与北风堡（24 行完整叙事，自然落点于塞北官道 road）
    // =========================================================================
    VS.s_jikan_north_vow = {
      bgm: 'emotional',
      bg: 'bg-img-jikan bg-room',
      loc: 'jikan',
      phase: 'journey',
      card: { vol: '第三卷 旅途篇', t: '终幕暗流', s: '乌木紫穗 · 北风堡' },
      lines: [
        { text: '开春前的傍晚，北林猎户带回急讯：赫兰边境爆发冬末魔物潮，阿斯拉新政权掐断了北上军需水路。', loc: 'jikan', bg: 'bg-img-jikan bg-room', portraits: [] },
        { text: '晚饭是我掌勺熬的火腿青菜粥。白气漫过掉了漆的矮桌，院角修剪整齐的老树在暮风里沙沙轻响。', portraits: [] },
        duoLine(['sylvia', '渔', 'serious'], ['ji', '霁馆主', 'normal'], 'sylvia', '霁叔，霁岚。开春的商队明早拔营，我打算随队北上去一趟赫兰公国。'),
        { text: '霁馆主端着粗瓷茶缸沉默片刻，既未打听我的真名，也没追问一个黑发游方少女为何偏赴极北苦寒之地。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'ji', slot: 'right', emo: 'normal', active: false }] },
        { text: '他起身走到木架最里侧，取下那把擦拭了三十年的乌黑木鞘铁剑，双手平放在矮桌上。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'ji', slot: 'right', emo: 'smile', active: false }] },
        duoLine(['sylvia', '渔', 'normal'], ['ji', '霁馆主', 'smile'], 'ji', '百炼凡铁，胜在重心稳。这三个月你把「不想」练进了骨子里，带它去见见塞北风雪，强过留在架上落灰。'),
        {
          if: function () { return !!ensureCausalState().clues.wind_god_echo; },
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'ji', slot: 'right', emo: 'normal', active: true }],
          speaker: '霁馆主',
          text: '……北边的风比澄岚硬得多。路上若遇见自在来去的高处之风，替这院子里的老树捎声平安。'
        },
        { text: '霁岚抿着嘴从袖袋摸出编得密密实实的亮紫色蝴蝶剑穗，低头一圈圈系紧在乌木剑柄末端。', portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'jilan', slot: 'right', emo: 'shy', active: false }] },
        {
          if: function () {
            var s = getAxisSummary('jilan');
            return !!(s && s.dominant === 'wanderlust');
          },
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'jilan', slot: 'right', emo: 'happy', active: true }],
          speaker: '霁岚',
          text: function () {
            var q = getEchoFor('jilan', '紫蝶剑穗先替我去见见塞北风雪。');
            return '「' + q + '」等我把桩功再练深一层，就提真剑北上找你汇合，别被魔物抢了先！';
          }
        },
        {
          if: function () {
            var s = getAxisSummary('jilan');
            return !(s && s.dominant === 'wanderlust');
          },
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'jilan', slot: 'right', emo: 'shy', active: true }],
          speaker: '霁岚',
          text: function () {
            var q = getEchoFor('jilan', '只要霁馆的灯还亮着，走再远我也会回来喝这碗热粥。');
            return '「' + q + '」木架第三排第四个空位我天天擦，敢在北边出事你就死定了！';
          }
        },
        duoLine(['sylvia', '渔', 'smile'], ['jilan', '霁岚', 'normal'], 'sylvia', '嗯，记下了。这枚紫蝶剑穗，我会护得干干净净。'),
        { text: '次日破晓，薄霜还覆在灰瓦檐角。我背起行囊推开房门，门槛边的竹篮里端正摞着四张温热的糖面饼。', portraits: [] },
        { text: '油纸包得严实，这回连边角都没焦。二楼木窗后闪过一抹亮紫色的蝴蝶发饰，又飞快缩回窗棂内侧。', portraits: [] },
        { text: '我将糖面饼贴身收好，按住腰间乌木铁剑，转身踏上通往苏秦北境的碎石官道。', loc: 'road', bg: 'bg-img-plain bg-plain', portraits: [] },
        { text: '北行十余日，空气干冷如刮骨薄刃。地平线尽头浮现出苏秦与赫兰交界的边塞重镇——北风堡。', portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: true }] },
        { text: '结满黑霜的石砌关墙下挤满受阻的车马，几名披着巴依纹章斗篷的随军药师正围着十几只木箱焦急踱步。', portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: false }] },
        {
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: false }],
          speaker: '巴依随军药师',
          text: '南线水路被卡死，绕道北风堡昼夜温差太烈，止血鲜草一旦冻裂叶脉，前线伤兵根本熬不过这周！'
        },
        {
          if: function () { return !!ensureCausalState().clues.polar_lily_bond; },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: true }],
          speaker: '渔',
          text: '若信得过我，让我试试箱壁控温。照看北方寒地花草的手法，可以把箱内锁在零度边缘。'
        },
        {
          if: function () { return !!ensureCausalState().clues.polar_lily_bond; },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: true }],
          text: '我避开人群耳目将手掌贴上木箱内壁，照着当年在冰系教室给艾诺那盆北极铃兰覆膜的手法渗入微弱冷气。'
        },
        {
          if: function () { return !!ensureCausalState().clues.polar_lily_bond; },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'smile', active: true }],
          text: '零冰碴、零气泡——霍尔老师铺设冻土白霜的耐性与艾诺亲手交接的手感，在千里外的风雪边关稳住了整队药箱。'
        },
        {
          if: function () { return !!ensureCausalState().clues.polar_lily_bond; },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: false }],
          speaker: '巴依随军药师',
          text: '奇技啊！箱内寒气均匀得像恒温地窖！姑娘既然北上赫兰，通关木牌与护送盘缠全包在商队身上！'
        },
        {
          if: function () { return !ensureCausalState().clues.polar_lily_bond; },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: true }],
          text: '我按住乌木铁剑上前应募护卫，凭着在霁馆打磨出的沉稳剑步替药队清开风雪路障，换得了通关文牒。'
        },
        { text: '跨过北风堡吊桥时，极北的烈风卷着细雪扑面而来，剑柄末端的紫色蝴蝶剑穗在风雪中猎猎轻扬。', portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: true }] },
        {
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.northern_vow = true;
            if (typeof LOCS !== 'undefined' && LOCS.road) LOCS.road.unlock = true;
            if (typeof flag === 'function') {
              flag('left_jikan', 1);
              flag('ch_distant_wind_1', 1);
            }
            if (typeof addItem === 'function' && typeof S !== 'undefined') {
              if (!S.inv.some(function (x) { return x.id === 'ebony_sword'; })) {
                addItem({ id: 'ebony_sword', name: '乌木紫穗剑', icon: bdIco('sword', 16), desc: '霁馆主相赠的三十年铁剑，柄端系着霁岚亲手编的紫蝶剑穗。' });
              }
              if (c.clues.polar_lily_bond && !S.inv.some(function (x) { return x.id === 'northwind_pass'; })) {
                addItem({ id: 'northwind_pass', name: '北风堡通关木牌', icon: bdIco('pass', 16), desc: '凭恒温冰膜护住巴依军需药箱后获赠的北境边关木牌。' });
              }
            }
            if (typeof S !== 'undefined') {
              S.atk = (S.atk || 1) + 4;
              S.gold = (S.gold || 0) + (c.clues.polar_lily_bond ? 15 : 6);
            }
            persistState();
          },
          loc: 'road',
          bg: 'bg-img-plain bg-plain',
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: true }],
          text: '【蝴蝶效应 · 旧风与北境之契】乌木铁剑与往昔冰膜手艺在塞北官道合流，前方便是银白苍茫的赫兰雪原。',
          freeRoam: true
        }
      ]
    };

    return VS;
  }

  /**
   * 将 6 大主线蝴蝶效应（全部 5 组关系双轴 + 4 枚暗线拼图）无损织入主线场景！
   * 仅通过条件行（if / 动态 text / do）注入，未触发时 100% 保持原轨迹，零破坏既有测试。
   */
  function patchMacroPayoffsIntoScenes(SCENES_OBJ) {
    if (!SCENES_OBJ) return;

    // 1. 注册所有双幕小场景与北境收束章
    var vs = buildVignetteScenes();
    Object.keys(vs).forEach(function (k) {
      SCENES_OBJ[k] = vs[k];
    });

    // 2. 织入 s_ice_melt_1 & s_ice_melt_2（艾诺双轴主线闭环：极北知己 vs 严苛试炼）
    var im1 = SCENES_OBJ.s_ice_melt_1;
    if (im1 && Array.isArray(im1.lines) && !im1._causalPatched) {
      im1._causalPatched = true;
      var ainoLeaveIdx = im1.lines.findIndex(function (L) {
        return L && typeof L.text === 'string' && L.text.indexOf('她走了') !== -1 && L.text.indexOf('没有回头') !== -1;
      });
      if (ainoLeaveIdx < 0) {
        ainoLeaveIdx = im1.lines.findIndex(function (L) { return L && L.freeRoam; });
      }
      var ainoPayoffBlock = [
        {
          if: function () { return getAinoArcMode() === 'kinship'; },
          bg: 'bg-img-ice-classroom bg-school',
          loc: 'ice_class',
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'aino', slot: 'right', emo: 'smile', active: true }],
          speaker: '艾诺',
          text: function () {
            var q = getEchoFor('aino', '冬天的孩子终会回到冬天。');
            return '……「' + q + '」这方手帕压在盆下给你擦手。到了赫兰，给你寄第一场干雪。';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.aino_arc = true;
            if (typeof S !== 'undefined') {
              S.mdef = (S.mdef || 0) + 3;
              S.mmp = (S.mmp || 12) + 12;
              S.mp = Math.min(S.mmp, (S.mp || 12) + 12);
              if (typeof addItem === 'function' && !S.inv.some(function (x) { return x.id === 'aino_academy_handkerchief'; })) {
                addItem({ id: 'aino_academy_handkerchief', name: '雪纹手帕', icon: bdIco('snowflake', 16), desc: '艾诺毕业前留在冰系窗台的亚麻手帕，角上绣着赫兰六瓣冰纹。' });
              }
            }
          }
        },
        {
          if: function () { return getAinoArcMode() === 'austere_mentor'; },
          bg: 'bg-img-ice-classroom bg-school',
          loc: 'ice_class',
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }, { id: 'aino', slot: 'right', emo: 'serious', active: true }],
          speaker: '艾诺',
          text: function () {
            var q = getEchoFor('aino', '别让手里的冰生出气泡。');
            return '……「' + q + '」这片钢冰笺留给你照着磨锋。三年内别懈怠，重逢时打满第四局。';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.aino_arc = true;
            if (typeof S !== 'undefined') {
              S.mag = (S.mag || 4) + 5;
              S.atk = (S.atk || 1) + 2;
              if (typeof addItem === 'function' && !S.inv.some(function (x) { return x.id === 'aino_frost_shard'; })) {
                addItem({ id: 'aino_frost_shard', name: '钢冰试炼笺', icon: bdIco('crystal', 16), desc: '艾诺凝结的零气泡薄冰铭牌，刻着赫兰枪冰三式发力轨迹。' });
              }
            }
          }
        }
      ];
      if (ainoLeaveIdx >= 0) {
        im1.lines.splice.apply(im1.lines, [ainoLeaveIdx, 0].concat(ainoPayoffBlock));
      }
    }

    var im2 = SCENES_OBJ.s_ice_melt_2;
    if (im2 && Array.isArray(im2.lines) && !im2._causalPatched) {
      im2._causalPatched = true;
      var im2End = im2.lines.findIndex(function (L) { return L && L.freeRoam; });
      if (im2End >= 0) {
        im2.lines.splice(im2End, 0, {
          if: function () { return getAinoArcMode() !== 'default'; },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'smile', active: true }],
          text: function () {
            return getAinoArcMode() === 'kinship'
              ? '花盆底下压着艾诺留下的雪纹手帕，左下角的冰膜比入冬时稳了许多。'
              : '指尖抚过那枚零气泡的钢冰试炼笺，左下角的冰膜一次便凝得平直如刃。';
          }
        });
      }
    }

    // 3. 织入 s_seven_mountains（诺艾儿双轴早期主线回响）
    var sm = SCENES_OBJ.s_seven_mountains;
    if (sm && Array.isArray(sm.lines) && !sm._causalPatched) {
      sm._causalPatched = true;
      var smEnd = sm.lines.findIndex(function (L) { return L && L.freeRoam; });
      if (smEnd >= 0) {
        sm.lines.splice(smEnd, 0,
          {
            if: function () { return getNoelleArcMode() === 'partnership'; },
            portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'noelle', slot: 'right', emo: 'smile', active: true }],
            speaker: '诺艾儿',
            text: function () {
              var q = getEchoFor('noelle', '用一杯水打赢一桶水的仗。');
              return '山再高也是由石头垒起来的。记住我们的交易——「' + q + '」下堂实战课继续对练。';
            }
          },
          {
            if: function () { return getNoelleArcMode() === 'guarded_pride'; },
            portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'noelle', slot: 'right', emo: 'serious', active: true }],
            speaker: '诺艾儿',
            text: function () {
              var q = getEchoFor('noelle', '记在左手背上的每一份人情，我都会凭本事还清。');
              return '就算山顶站着列强，平民也能凭精算走到山腰。「' + q + '」我绝不掉队。';
            }
          }
        );
      }
    }

    // 4. 织入 s_turnpoint（第十章 转折点一）：
    //    - 诺艾儿双轴主线收束（寒假离校前图书馆赠手稿 / 奉还勘误册）
    //    - 爱丽丝双轴收束（寒假花饼与回声呼应）
    //    - 暗潮先觉（政变前夜书房拼合巴依使团与贝尔蒙调防暗流）
    //    - 夏洛特双轴收束（东逃夜巡防抄件 vs 宿敌战书羊皮笺）
    var tp = SCENES_OBJ.s_turnpoint;
    if (tp && Array.isArray(tp.lines) && !tp._causalPatched) {
      tp._causalPatched = true;

      // 4a. 寒假回府前夕：诺艾儿双轴收束礼
      var winterReturnIdx = tp.lines.findIndex(function (L) {
        return L && typeof L.text === 'string' && L.text.indexOf('十五岁的冬天') !== -1;
      });
      var noellePayoffBlock = [
        {
          if: function () { return getNoelleArcMode() === 'partnership'; },
          bg: 'bg-img-library bg-study',
          loc: 'library',
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'noelle', slot: 'right', emo: 'smile', active: true }],
          speaker: '诺艾儿',
          text: function () {
            var q = getEchoFor('noelle', '用一杯水打赢一桶水的仗。');
            return '【蝴蝶效应 · 平等同盟】寒假离校前，诺艾儿在图书馆老位置推来一册灰布手稿：「省魔回路全推导完啦——『' + q + '』开春见，搭档。」';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.noelle_arc = true;
            if (typeof S !== 'undefined') {
              S.mmp = (S.mmp || 12) + 15;
              S.mp = Math.min(S.mmp, (S.mp || 12) + 15);
              if (S.stats) S.stats.mind = Math.min(100, (S.stats.mind || 15) + 3);
              if (typeof addItem === 'function' && !S.inv.some(function (x) { return x.id === 'noelle_manuscript'; })) {
                addItem({ id: 'noelle_manuscript', name: '诺艾儿的省魔手稿', icon: bdIco('compass', 16), desc: '夹着橘猫胡须书签的手写回路册，凝结着三年并肩推演的默契。' });
              }
            }
          }
        },
        {
          if: function () { return getNoelleArcMode() === 'guarded_pride'; },
          bg: 'bg-img-library bg-study',
          loc: 'library',
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'noelle', slot: 'right', emo: 'serious', active: true }],
          speaker: '诺艾儿',
          text: function () {
            var q = getEchoFor('noelle', '记在左手背上的每一份人情，我都会凭本事还清。');
            return '【蝴蝶效应 · 自尊防线】离校前，诺艾儿划掉左手背最后一行字，将一册勘误笔记放在桌上：「『' + q + '』账清了，下学期考场再分高下。」';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.noelle_arc = true;
            if (typeof S !== 'undefined') {
              S.mdef = (S.mdef || 0) + 4;
              if (typeof addItem === 'function' && !S.inv.some(function (x) { return x.id === 'noelle_errata'; })) {
                addItem({ id: 'noelle_errata', name: '精算勘误册', icon: bdIco('notebook', 16), desc: '字迹严整如尺的高阶防御术式勘误册，一笔一画算清所有骄傲与人情。' });
              }
            }
          }
        }
      ];
      if (winterReturnIdx >= 0) {
        tp.lines.splice.apply(tp.lines, [winterReturnIdx, 0].concat(noellePayoffBlock));
      }

      var preStormIdx = tp.lines.findIndex(function (L) {
        return L && typeof L.text === 'string' && L.text.indexOf('我躺在床上') !== -1;
      });
      var preStormBlock = [
        // Payoff ③：爱丽丝倾向分流（寒假回府心绪）
        {
          if: function () { return getAliceArcMode() === 'independence'; },
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'alice', slot: 'right', emo: 'happy', active: true }],
          speaker: '爱丽丝',
          text: function () {
            var q = getEchoFor('alice', '风往哪边吹由我自己去听。');
            return '……姐姐大人，这是照食谱烤的花饼。风系课我已能独自偏转气流——一直记着那句「' + q + '」。';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.alice_arc = true;
            if (typeof addItem === 'function' && typeof S !== 'undefined' && !S.inv.some(function (x) { return x.id === 'alice_flower_cake'; })) {
              addItem({ id: 'alice_flower_cake', name: '爱丽丝的花饼', icon: bdIco('cake', 16), desc: '花瓣摆成歪斜笑脸的蜂蜜烤饼，夹着独立迎风的约定。' });
            }
          }
        },
        {
          if: function () { return getAliceArcMode() === 'obsession'; },
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'alice', slot: 'right', emo: 'shy', active: true }],
          speaker: '爱丽丝',
          text: function () {
            var q = getEchoFor('alice', '待在我看得见的地方就好。');
            return '……姐姐大人，花饼给你。右腕的碎贝壳我每天都擦得很干净……像你说过的，「' + q + '」。';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.alice_arc = true;
            if (typeof addItem === 'function' && typeof S !== 'undefined' && !S.inv.some(function (x) { return x.id === 'alice_flower_cake'; })) {
              addItem({ id: 'alice_flower_cake', name: '爱丽丝的花饼', icon: bdIco('cake', 16), desc: '花瓣摆成笑脸的蜂蜜烤饼，藏着寸步难离的眷恋。' });
            }
          }
        },
        // Payoff ①：【暗潮先觉】书房隐藏推演
        {
          if: function () { return canTriggerDarkTide(); },
          bg: 'bg-img-study bg-study',
          loc: 'study',
          bgm: 'suspense',
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: true }],
          text: '【蝴蝶效应 · 暗潮先觉】管事来报巴依使团被卡在城外临时盘查时，我端着红叶茶的手猛然停在书房廊外。'
        },
        {
          if: function () { return canTriggerDarkTide(); },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: true }],
          text: '冰晶宫殿里两页线索瞬间咬合——阿琼本子上被人打探的客房换班动线，加上王都贝尔蒙私军的异常调防！'
        },
        {
          if: function () { return canTriggerDarkTide(); },
          bgm: 'upset',
          portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }, { id: 'claude', slot: 'right', emo: 'serious', active: true }],
          speaker: '克劳德',
          text: '……连使团礼宾官也在摸府里的侧门？好敏锐的判断，希尔维亚。我这就让雷纳德守住东翼岔口，收好这枚暗记。',
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.dark_tide = true;
            if (typeof S !== 'undefined') {
              S.mag = (S.mag || 4) + 6;
              if (S.stats) S.stats.mind = Math.min(100, (S.stats.mind || 15) + 5);
              if (typeof addItem === 'function' && !S.inv.some(function (x) { return x.id === 'frost_cipher'; })) {
                addItem({ id: 'frost_cipher', name: '霜封暗记', icon: bdIco('snowflake', 16), desc: '政变前夜拼出暗流后父亲交托的隐秘联络银徽。' });
              }
            }
          }
        },
        {
          if: function () { return canTriggerDarkTide(); },
          bg: 'bg-night',
          portraits: [],
          text: '回房前我把行囊与干粮提前扣紧在床侧。夜色深得像拉满的弓弦。'
        }
      ];

      if (preStormIdx >= 0) {
        tp.lines.splice.apply(tp.lines, [preStormIdx, 0].concat(preStormBlock));
      }

      // Payoff ②：夏洛特双轴收束（卸下面具巡防抄件 vs 骄傲较劲战书羊皮笺）
      var escapeIdx = tp.lines.findIndex(function (L) {
        return L && typeof L.text === 'string' && L.text.indexOf('往东。不拐弯。') !== -1;
      });
      var rivalGraceBlock = [
        {
          if: function () { return getCharlotteArcMode() === 'candor'; },
          bg: 'bg-img-forest bg-forest',
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: true }],
          text: function () {
            var q = getEchoFor('charlotte', '贝尔蒙家从不欠人情。');
            return '【蝴蝶效应 · 政敌的体面】远处传来追兵马蹄声。我摸出离校时纪念林石牌下压着的无名换防表，末尾写着：「' + q + '」';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.rival_grace = true;
            if (typeof S !== 'undefined') {
              S.gold = (S.gold || 0) + 15;
              S.st = S.mst || S.st;
              if (typeof addItem === 'function' && !S.inv.some(function (x) { return x.id === 'belmont_schedule'; })) {
                addItem({ id: 'belmont_schedule', name: '无名巡防抄件', icon: bdIco('scroll', 16), desc: '带着淡淡薄荷茶香的换防时间表，字迹工整如尺量。' });
              }
            }
          }
        },
        {
          if: function () { return getCharlotteArcMode() === 'candor'; },
          bg: 'bg-img-forest bg-forest',
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: true }],
          text: '借着那份时间表标出的半小时换岗空窗，我贴着枯草水渠悄然穿过封锁线，随身盘缠分毫未损。'
        },
        {
          if: function () { return getCharlotteArcMode() === 'rivalry'; },
          bg: 'bg-img-forest bg-forest',
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'serious', active: true }],
          text: function () {
            var q = getEchoFor('charlotte', '除了我夏洛特·贝尔蒙，谁也没资格赢过你。');
            return '【蝴蝶效应 · 宿敌锋芒】夜林寒风刺骨，指尖触到书袋夹层里夏洛特塞来的烫金战书：「' + q + '」——绝不能倒在半路。';
          },
          do: function () {
            var c = ensureCausalState();
            c.payoffsTriggered.rival_grace = true;
            if (typeof S !== 'undefined') {
              S.mag = (S.mag || 4) + 4;
              if (typeof addItem === 'function' && !S.inv.some(function (x) { return x.id === 'belmont_challenge'; })) {
                addItem({ id: 'belmont_challenge', name: '烫金战书羊皮笺', icon: bdIco('crown', 16), desc: '夏洛特离校前塞进书袋的约战书，字里行间傲气凛然。' });
              }
            }
          }
        }
      ];

      if (escapeIdx >= 0) {
        tp.lines.splice.apply(tp.lines, [escapeIdx + 1, 0].concat(rivalGraceBlock));
      }
    }

    // 5. 织入 s_jikan_arrive（第三卷 抵达霁馆时呼应爱丽丝弧光）
    var jk = SCENES_OBJ.s_jikan_arrive;
    if (jk && Array.isArray(jk.lines) && !jk._causalPatched) {
      jk._causalPatched = true;
      var endIdx = jk.lines.findIndex(function (L) { return L && L.freeRoam; });
      if (endIdx < 0) endIdx = Math.max(0, jk.lines.length - 1);
      if (endIdx >= 0) {
        jk.lines.splice(endIdx, 0, {
          if: function () { return getAliceArcMode() !== 'default'; },
          portraits: [{ id: 'sylvia', slot: 'center', emo: 'normal', active: true }],
          text: function () {
            var mode = getAliceArcMode();
            return mode === 'independence'
              ? '二楼木窗外刮过干冷的北风。我想起爱丽丝独自偏转气流的模样——只要她还在听着风向，就一定能凭自己的翅膀活下去。'
              : '二楼木窗外刮过干冷的北风。我想起爱丽丝攥紧碎贝壳手绳的指尖——在找到她之前，我绝不能倒在这种地方。';
          }
        });
      }
    }

    // 6. 织入 s_distant_wind_1（将北境誓言因果分歧无损合流入第三卷主线辞行，杜绝重演与双剑）
    var dw1 = SCENES_OBJ.s_distant_wind_1;
    if (dw1 && Array.isArray(dw1.lines) && !dw1._causalPatched) {
      dw1._causalPatched = true;
      var swordIdx = dw1.lines.findIndex(function (L) {
        return L && L.item && L.item.id === 'ebony_sword';
      });
      if (swordIdx >= 0) {
        var farewellPayoffBlock = [
          {
            if: function () { return !!ensureCausalState().clues.wind_god_echo && !ensureCausalState().payoffsTriggered.northern_vow; },
            portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }, { id: 'ji', slot: 'right', emo: 'normal', active: true }],
            speaker: '老霁',
            text: '……北边的风比澄岚硬得多。路上若遇见自在来去的高处之风，替这院子里的老树捎声平安。'
          },
          {
            if: function () {
              var s = getAxisSummary('jilan');
              return !ensureCausalState().payoffsTriggered.northern_vow && !!(s && s.dominant === 'wanderlust');
            },
            portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'jilan', slot: 'right', emo: 'happy', active: true }],
            speaker: '霁岚',
            text: function () {
              var q = getEchoFor('jilan', '紫蝶剑穗先替我去见见塞北风雪。');
              return '「' + q + '」等我把桩功再练深一层，就提真剑北上找你汇合，别被魔物抢了先！';
            }
          },
          {
            if: function () {
              var s = getAxisSummary('jilan');
              return !ensureCausalState().payoffsTriggered.northern_vow && !!(s && s.dominant === 'hearth');
            },
            portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'jilan', slot: 'right', emo: 'shy', active: true }],
            speaker: '霁岚',
            text: function () {
              var q = getEchoFor('jilan', '只要霁馆的灯还亮着，走再远我也会回来喝这碗热粥。');
              return '「' + q + '」木架第三排第四个空位我天天擦，敢在北边出事你就死定了！';
            }
          }
        ];
        dw1.lines.splice.apply(dw1.lines, [swordIdx + 1, 0].concat(farewellPayoffBlock));
      }

      var musaFilmIdx = dw1.lines.findIndex(function (L) {
        return L && typeof L.text === 'string' && L.text.indexOf('无气泡冰膜') !== -1;
      });
      if (musaFilmIdx >= 0) {
        var northPassBlock = [
          {
            if: function () { return !!ensureCausalState().clues.polar_lily_bond && !ensureCausalState().payoffsTriggered.northern_vow; },
            portraits: [{ id: 'sylvia', slot: 'left', emo: 'smile', active: false }, { id: 'musa', slot: 'right', emo: 'normal', active: true }],
            speaker: '穆萨',
            text: '零冰碴、零气泡，这控温手艺堪比恒温地窖！这枚北风堡通关木牌你收好，沿途关卡畅通无阻。',
            do: function () {
              var c = ensureCausalState();
              c.payoffsTriggered.northern_vow = true;
              if (typeof flag === 'function') flag('left_jikan', 1);
              if (typeof addItem === 'function' && typeof S !== 'undefined') {
                addItem({ id: 'northwind_pass', name: '北风堡通关木牌', icon: bdIco('pass', 16), desc: '凭恒温冰膜护住巴依军需药箱后获赠的北境边关木牌。' });
              }
              if (typeof S !== 'undefined') {
                S.atk = (S.atk || 1) + 4;
                S.gold = (S.gold || 0) + 15;
              }
              persistState();
            }
          }
        ];
        dw1.lines.splice.apply(dw1.lines, [musaFilmIdx + 1, 0].concat(northPassBlock));
      }

      var dw1EndIdx = dw1.lines.findIndex(function (L) { return L && L.flag === 'ch_distant_wind_1'; });
      if (dw1EndIdx >= 0) {
        dw1.lines.splice(dw1EndIdx, 0, {
          do: function () {
            var c = ensureCausalState();
            if (typeof flag === 'function') flag('left_jikan', 1);
            if (canTriggerNorthernVow() && !c.payoffsTriggered.northern_vow) {
              c.payoffsTriggered.northern_vow = true;
              if (typeof S !== 'undefined') {
                S.atk = (S.atk || 1) + 4;
                S.gold = (S.gold || 0) + 6;
              }
              persistState();
            }
          }
        });
      }
    }
  }

  /**
   * 动态升级「爱丽丝来信」拆信演出（仅当玩家积累了爱丽丝因果倾向或回声时切换专属版本，初始状态 100% 保留原版）
   */
  function syncAliceLetterDOM() {
    if (typeof document === 'undefined') return;
    var article = document.querySelector('#letter-demo .alice-letter');
    if (!article) return;
    if (!article.getAttribute('data-orig-html')) {
      article.setAttribute('data-orig-html', article.innerHTML);
    }
    var mode = getAliceArcMode();
    var c = ensureCausalState();
    var hasAliceEcho = c.echoes.some(function (e) { return e.charId === 'alice'; });
    if (mode === 'default' && !hasAliceEcho) {
      article.innerHTML = article.getAttribute('data-orig-html');
      return;
    }
    var echoLine = getEchoFor('alice', mode === 'obsession' ? '姐姐大人在哪里，我就在哪里。' : '风往哪边吹由我自己去听。');
    if (mode === 'obsession') {
      article.innerHTML =
        '<div class="letter-crest">' + bdIco('snowflake', 20) + '</div>' +
        '<p class="letter-to">姐姐大人：</p>' +
        '<p>冰系窗台的北极铃兰我每天下午两点十三分都去看过。<br>右腕上的碎贝壳手绳也一直系得很紧。</p>' +
        '<p>我一直记着——「' + escapeHtml(echoLine) + '」</p>' +
        '<p>无论隔着多少重风暴，<br>我一定会找到姐姐大人，再也不分开。</p>' +
        '<p class="letter-sign">爱丽丝</p>';
    } else {
      article.innerHTML =
        '<div class="letter-crest">' + bdIco('snowflake', 20) + '</div>' +
        '<p class="letter-to">姐姐大人：</p>' +
        '<p>风系进阶课的气流偏转我已经能独立完成了。<br>最近还在图书馆借了赫兰语辞典。</p>' +
        '<p>如姐姐大人所言——「' + escapeHtml(echoLine) + '」</p>' +
        '<p>等我把风驯得更稳一些，<br>我们在高处重逢时，换我替你挡风。</p>' +
        '<p class="letter-sign">爱丽丝</p>';
    }
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * 获取当前地点可用的小场景列表（供自由探索热点与交谈菜单接入）
   */
  function getAvailableVignettesHere(targetS) {
    var st = targetS || getStateObj();
    if (!st || !st.freeRoam) return [];
    var list = VIGNETTE_CATALOG.filter(function (v) {
      return v.locs.indexOf(st.loc) !== -1 && v.canPlay(st);
    });
    var c = ensureCausalState(st);
    if (st.loc === 'jikan' && (st.phase === 'journey' || st.phase === 'finale') && canTriggerNorthernVow(st) && !c.payoffsTriggered.northern_vow && !(st.flags && st.flags.ch_distant_wind_1)) {
      list.push({
        id: 's_jikan_north_vow',
        title: '辞行北上·乌木紫穗之契',
        charId: 'jilan',
        icon: bdIco('diamond'),
        locs: ['jikan'],
        x: 88, y: 62,
        isPayoffScene: true
      });
    }
    return list;
  }

  /**
   * 在自由探索舞台上渲染可玩小场景微光入口（自动避开中心立绘区域，且层级高于立绘容器）
   */
  function renderVignetteHotspots() {
    if (typeof document === 'undefined') return;
    var box = document.getElementById('hotspots');
    var st = getStateObj();
    if (!box || !st || !st.freeRoam || st.ageY < 1) return;
    var avail = getAvailableVignettesHere(st);
    if (!avail.length) return;
    box.classList.remove('hidden');
    avail.forEach(function (v, idx) {
      if (box.querySelector('[data-vignette="' + v.id + '"]')) return;
      var btn = document.createElement('button');
      btn.className = 'hotspot vignette-spot' + (v.isPayoffScene ? ' payoff-spot' : '');
      btn.setAttribute('data-vignette', v.id);
      var posX = typeof v.x === 'number' ? v.x : (idx % 2 === 0 ? 14 : 86);
      var posY = Math.max(17, Math.min(64, typeof v.y === 'number' ? v.y : (26 + idx * 10)));
      btn.style.left = posX + '%';
      btn.style.top = posY + '%';
      btn.innerHTML = '<span class="hs-icon">' + v.icon + '</span><span class="hs-title">' + v.title + '</span>';
      btn.onclick = function (e) {
        if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
        if (!st.freeRoam) return;
        if (typeof sfx === 'function') sfx('magic');
        if (typeof runScene === 'function') runScene(v.id);
      };
      box.appendChild(btn);
    });
  }

  /**
   * 多结局星轨趋向评估器：由 5 组关系双轴 + 4 枚暗线拼图 + 已触发蝴蝶效应共同驱动
   */
  function getEndingTendency(targetS) {
    var st = targetS || getStateObj();
    var c = ensureCausalState(st);
    var ax = c.axes || {};
    var al = ax.alice || { independence: 0, obsession: 0 };
    var nl = ax.noelle || { partnership: 0, guarded_pride: 0 };
    var ch = ax.charlotte || { candor: 0, rivalry: 0 };
    var ai = ax.aino || { kinship: 0, austere_mentor: 0 };
    var jl = ax.jilan || { hearth: 0, wanderlust: 0 };

    var unlockedClues = countUnlockedClues(st);
    var triggeredPayoffs = Object.keys(c.payoffsTriggered || {}).filter(function (k) {
      return !!c.payoffsTriggered[k];
    }).length;
    var totalAxisPoints =
      (al.independence || 0) + (al.obsession || 0) +
      (nl.partnership || 0) + (nl.guarded_pride || 0) +
      (ch.candor || 0) + (ch.rivalry || 0) +
      (ai.kinship || 0) + (ai.austere_mentor || 0) +
      (jl.hearth || 0) + (jl.wanderlust || 0);

    var axisModes = {
      alice: getAliceArcMode(st),
      noelle: getNoelleArcMode(st),
      charlotte: getCharlotteArcMode(st),
      aino: getAinoArcMode(st),
      jilan: (jl.hearth < 2 && jl.wanderlust < 2) ? 'default' : (jl.hearth >= jl.wanderlust ? 'hearth' : 'wanderlust')
    };

    var scores = {
      dawn_reunion:
        (al.independence || 0) * 1.4 +
        (nl.partnership || 0) * 1.5 +
        (ch.candor || 0) * 1.6 +
        (ai.kinship || 0) * 1.3 +
        (jl.hearth || 0) * 1.0 +
        (c.clues.bayi_banquet_leak ? 3.5 : 0) +
        (c.clues.belmont_troop_shift ? 3.5 : 0) +
        (c.payoffsTriggered.dark_tide ? 2.5 : 0),
      frost_sovereign:
        (ai.austere_mentor || 0) * 1.8 +
        (ch.rivalry || 0) * 1.7 +
        (nl.guarded_pride || 0) * 1.6 +
        (jl.wanderlust || 0) * 1.2 +
        (c.clues.polar_lily_bond ? 1.5 : 0),
      twin_winds:
        (al.independence || 0) * 1.8 +
        (jl.wanderlust || 0) * 1.8 +
        (ai.kinship || 0) * 1.0 +
        (c.clues.wind_god_echo ? 4.0 : 0) +
        (c.clues.polar_lily_bond ? 3.0 : 0) +
        (c.payoffsTriggered.northern_vow ? 2.0 : 0),
      sheltered_hearth:
        (al.obsession || 0) * 2.0 +
        (jl.hearth || 0) * 1.8 +
        (ai.kinship || 0) * 1.4 +
        (ch.candor || 0) * 1.0 +
        (c.clues.wind_god_echo ? 1.5 : 0)
    };

    var TENDENCY_CATALOG = {
      unwritten_snow: {
        id: 'unwritten_snow',
        badge: '静水初雪',
        title: '初雪未落 · 静水待明',
        subtitle: '星轨尚在蓄势，因果之弦待你落笔',
        summary: '各条关系双轴与暗线拼图仍处于初始平衡。前往小场景与灵魂交谈，你的每次回应都会拨动远方终局的指针。'
      },
      dawn_reunion: {
        id: 'dawn_reunion',
        badge: '破晓明约',
        title: '凛冬破晓 · 众星同归',
        subtitle: '洞悉暗潮并守住同盟与体面，风雪散后共迎晨光',
        summary: '你既提前看穿王都暗流，又以平视与坦诚拢住同窗与宿敌。待风雪停歇，所有留下的契约与暗记都将汇成破晓之路。'
      },
      frost_sovereign: {
        id: 'frost_sovereign',
        badge: '霜冕孤锋',
        title: '孤锋霜冕 · 极北独行',
        subtitle: '以最严苛的试炼与锋芒自成秩序，凭剑与冰破局',
        summary: '你选择了彼此较劲、算清人情与生死磨锋的冷冽路径。纵使前路漫漫无靠，掌中无气泡之冰与乌木铁剑已足够劈开寒夜。'
      },
      twin_winds: {
        id: 'twin_winds',
        badge: '双风并翼',
        title: '双风并翼 · 远行之誓',
        subtitle: '妹妹学会独自听风，旧友奔赴山海，终在高处重逢',
        summary: '独立乘风的爱丽丝、系上紫蝶剑穗的北境远行与高天旧风彼此呼应。你们终将在风暴眼之上并肩而立，不再困于旧日院墙。'
      },
      sheltered_hearth: {
        id: 'sheltered_hearth',
        badge: '霜檐暖灯',
        title: '霜檐暖灯 · 执手归处',
        subtitle: '紧握碎贝壳与霁馆灯火，替漂泊之人留一处永不熄灭的炉火',
        summary: '你把最深的牵挂留给了咫尺身畔的温热灯火。无论风雪把人吹去何方，那碗热粥与紧握的碎贝壳手绳都将牵引彼此归航。'
      }
    };

    var pickedId = 'unwritten_snow';
    var confidence = 18;
    if (totalAxisPoints >= 2 || unlockedClues >= 1) {
      var order = ['dawn_reunion', 'twin_winds', 'sheltered_hearth', 'frost_sovereign'];
      order.sort(function (a, b) { return scores[b] - scores[a]; });
      pickedId = order[0];
      var topScore = scores[pickedId] || 0;
      var secondScore = scores[order[1]] || 0;
      confidence = Math.max(32, Math.min(98, Math.round(36 + topScore * 4.2 + (topScore - secondScore) * 3.5)));
    }

    var meta = TENDENCY_CATALOG[pickedId];
    return {
      id: meta.id,
      badge: meta.badge,
      title: meta.title,
      subtitle: meta.subtitle,
      summary: meta.summary,
      confidence: confidence,
      unlockedClues: unlockedClues,
      totalAxisPoints: totalAxisPoints,
      triggeredPayoffs: triggeredPayoffs,
      scores: scores,
      axisModes: axisModes
    };
  }

  /**
   * 场景因果对话钩子生成器：供主线场景、AI 主动开场白与终局分支直接读取
   */
  function getCausalDialogueHooks(sceneId, targetS) {
    var st = targetS || getStateObj();
    var c = ensureCausalState(st);
    var activeSc = (typeof currentScene !== 'undefined' && currentScene) ? currentScene : (st && st.scene);
    var sc = String(sceneId || activeSc || 'free-roam');
    var dominantAxes = {};
    Object.keys(AXIS_META).forEach(function (cid) {
      var s = getAxisSummary(cid, st);
      dominantAxes[cid] = {
        dominant: s.dominant,
        dominantLabel: s.dominantLabel,
        leftKey: s.leftKey,
        leftVal: s.leftVal,
        rightKey: s.rightKey,
        rightVal: s.rightVal
      };
    });

    var unlockedClues = Object.keys(CLUE_META).filter(function (ck) { return !!c.clues[ck]; });
    var hooks = [];

    function pushAxisHook(cid, leftCue, rightCue) {
      var s = dominantAxes[cid];
      if (!s || s.dominant === 'balanced') return;
      var isLeft = s.dominant === s.leftKey;
      var q = getEchoFor(cid, '');
      hooks.push({
        id: 'axis_' + cid + '_' + s.dominant,
        charId: cid,
        type: 'axis',
        label: AXIS_META[cid].name + ' · ' + s.dominantLabel,
        cue: isLeft ? leftCue : rightCue,
        echoQuote: q
      });
    }

    function pushClueHook(ck, charId, cue) {
      if (!c.clues[ck]) return;
      hooks.push({
        id: 'clue_' + ck,
        charId: charId || '',
        type: 'clue',
        label: CLUE_META[ck].title,
        cue: cue,
        echoQuote: ''
      });
    }

    // 根据场景定制高优先级钩子
    if (sc === 's_turnpoint' || sc === 's_star_festival' || sc === 's_star' || sc === 's_tree') {
      if (canTriggerDarkTide(st)) {
        pushClueHook('bayi_banquet_leak', 'claude', '阿琼小本子里的宴席细节与城郊私军调防已拼合成局，书房深夜提前示警。');
      }
      pushAxisHook('charlotte', '纪念林树影下卸下面具的默契，化作东郊巡防换岗空窗的无声体面。', '榜单赌约磨出的宿敌锋芒，化作绝不容她倒在半路的烫金战书。');
      pushAxisHook('noelle', '平视相待的学术同盟，令她在离校前倾囊相授省魔手稿。', '平民首席紧绷的自尊防线，令她工整奉还精算勘误册结清人情。');
      pushAxisHook('alice', '学会独立听风的爱丽丝，在花饼与家书中立下高处挡风之约。', '紧攥白色碎贝壳的爱丽丝，将全部念想系在姐姐大人身侧。');
    } else if (sc === 's_ice_melt_1' || sc === 's_aino_sparring') {
      pushAxisHook('aino', '极北知己之谊，在药箱左下角那道略薄冰膜与压凉热麦汤的指尖间无声重逢。', '严苛试炼之约，让赫兰冻土风雪中的每一招冰墙都带着未完第四局的锋芒。');
      pushClueHook('polar_lily_bond', 'aino', '当年照料北极铃兰「伊诺」磨出的恒温薄冰膜手艺，成了峡谷护药与无声相认的凭证。');
    } else if (sc === 's_jikan_arrive' || sc === 's_distant_wind_1' || sc === 's_jikan_north_vow') {
      pushAxisHook('jilan', '霁馆暖灯与第三排第四个空竹剑架，替远行之人守住随时可回的归处。', '乌木剑上系着的亮紫蝶穗，承载着塞北风雪重逢的剑客远行之约。');
      pushClueHook('wind_god_echo', 'ji', '院角修剪整齐的老树与「岚」之旧名，隐隐牵连着远方高天上的风。');
      pushClueHook('polar_lily_bond', 'musa', '无气泡恒温冰膜稳稳护住白苔与止血青藓药箱，赢得北风堡通关木牌。');
    } else if (sc === 's_words_to_wind' || sc === 's_eye_of_storm' || sc === 's_leaky_cup') {
      pushAxisHook('alice', '风神门下沉静听风的爱丽丝，稳步将姐姐教过的“引导风”淬成大风格局。', '摩挲碎贝壳手绳的爱丽丝，以不容动摇的执念穿越风暴寻找姐姐大人。');
      pushClueHook('wind_god_echo', 'alice', '高天风暴眼与澄岚院角老树隔着疆界呼应同一缕自由之风。');
    } else {
      // 通用与自由探索：按当前最强倾向与已解锁线索收集钩子
      pushAxisHook('alice', '爱丽丝正学着用自己的目光丈量风向与世界。', '爱丽丝将全部安心系在碎贝壳手绳与姐姐身侧。');
      pushAxisHook('noelle', '诺艾儿已将你列进左手背日程表与平等同盟。', '诺艾儿仍以分毫不差的较真守着自尊与赌约。');
      pushAxisHook('charlotte', '夏洛特在无人处已卸下贝尔蒙家的冷硬假面。', '夏洛特将你视作唯一配得上全力竞逐的劲敌。');
      pushAxisHook('aino', '艾诺已把你当作同样懂极寒与温差的极北知己。', '艾诺以赫兰生死实战的标准持续雕琢你的冰锋。');
      pushAxisHook('jilan', '霁岚把霁馆的热粥与灯火当作「渔」永远的归处。', '霁岚向往着与「渔」一同提剑奔赴塞北风雪。');
      if (c.clues.bayi_banquet_leak) pushClueHook('bayi_banquet_leak', 'ajun', '阿琼小本子旁夹着的宴席询问细节暗藏异国眼线。');
      if (c.clues.belmont_troop_shift) pushClueHook('belmont_troop_shift', 'charlotte', '王都城郊私军调防与关口盘查正悄然收紧。');
      if (c.clues.polar_lily_bond) pushClueHook('polar_lily_bond', 'aino', '北极铃兰「伊诺」的恒温冰膜手艺已化作肌肉本能。');
      if (c.clues.wind_god_echo) pushClueHook('wind_god_echo', 'jilan', '霁馆院角老树下封存着故人「岚」的旧风之名。');
    }

    var featuredEcho = (Array.isArray(c.echoes) && c.echoes.length) ? c.echoes[0] : null;
    return {
      sceneId: sc,
      dominantAxes: dominantAxes,
      unlockedClues: unlockedClues,
      activeHooks: hooks.slice(0, 6),
      featuredEcho: featuredEcho ? {
        charId: featuredEcho.charId || '',
        speaker: featuredEcho.speaker || '',
        quote: featuredEcho.quote || '',
        weight: featuredEcho.weight || 1
      } : null,
      endingTendency: getEndingTendency(st)
    };
  }

  /**
   * 绘制冰晶星轨天球档案风格「4枚暗线线索星轨连线 SVG」
   */
  function buildClueStarWebSVG(c, targetS) {
    var st = targetS || getStateObj();
    var ph = (st && st.phase) || 'prologue';
    var isPreAcademy = (ph === 'prologue' || ph === 'childhood' || ph === 'youth');
    var clues = (c && c.clues) || {};
    var n1 = !!clues.bayi_banquet_leak;
    var n2 = !!clues.belmont_troop_shift;
    var n3 = !!clues.polar_lily_bond;
    var n4 = !!clues.wind_god_echo;
    var darkTideLit = n1 && n2;
    var northWindLit = n3 && n4;
    var crossLit = (n1 || n2) && (n3 || n4);
    var litCount = (n1 ? 1 : 0) + (n2 ? 1 : 0) + (n3 ? 1 : 0) + (n4 ? 1 : 0);
    var isEarlyAcademyFog = (ph === 'academy' && litCount < 1);

    function isNodeFogged(clueKey, lit) {
      if (lit) return false;
      if (isPreAcademy || isEarlyAcademyFog) return true;
      var meta = CLUE_META[clueKey];
      if (meta && Array.isArray(meta.allowedPhases) && meta.allowedPhases.indexOf(ph) === -1) return true;
      return false;
    }

    function threadLine(x1, y1, x2, y2, lit, major) {
      if (lit) {
        return '<line class="sw-thread is-lit' + (major ? ' is-major' : '') + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' +
          'stroke="#1658EB" stroke-width="' + (major ? '2.6' : '2.2') + '" stroke-opacity="0.96" filter="url(#sw-glow)"/>';
      }
      return '<line class="sw-thread is-unlit" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' +
        'stroke="rgba(22,88,235,0.34)" stroke-width="1.25" stroke-dasharray="4 4"/>';
    }

    function clueNode(cx, cy, lit, label, sub, align, fogged) {
      var textAnchor = align || 'middle';
      var tx = align === 'start' ? cx + 19 : (align === 'end' ? cx - 19 : cx);
      var ty = align === 'middle' ? cy + 24 : cy - 2;
      var subY = ty + 15;
      if (lit) {
        return (
          '<g class="sw-node lit">' +
            '<circle class="sw-node-glow" cx="' + cx + '" cy="' + cy + '" r="15" fill="rgba(56,189,248,0.28)" stroke="none"/>' +
            '<circle class="sw-node-halo" cx="' + cx + '" cy="' + cy + '" r="11.5" fill="rgba(255,255,255,0.92)" stroke="#1658EB" stroke-width="1.8"/>' +
            '<polygon class="sw-node-diamond" points="' + cx + ',' + (cy - 6.5) + ' ' + (cx + 5.2) + ',' + cy + ' ' + cx + ',' + (cy + 6.5) + ' ' + (cx - 5.2) + ',' + cy + '" fill="#1658EB" stroke="#FFFFFF" stroke-width="1.1"/>' +
            '<text class="sw-node-title" x="' + tx + '" y="' + ty + '" text-anchor="' + textAnchor + '" fill="#0B1C3D" font-size="12.5" font-weight="700">' + label + '</text>' +
            '<text class="sw-node-sub" x="' + tx + '" y="' + subY + '" text-anchor="' + textAnchor + '" fill="#1E4080" font-size="11.5" font-weight="600">' + sub + '</text>' +
          '</g>'
        );
      }
      return (
        '<g class="sw-node locked' + (fogged ? ' is-fogged' : '') + '">' +
          '<circle class="sw-node-halo" cx="' + cx + '" cy="' + cy + '" r="11" fill="rgba(255,255,255,0.82)" stroke="rgba(22,88,235,0.44)" stroke-width="1.2" stroke-dasharray="3 3"/>' +
          '<circle class="sw-node-dot" cx="' + cx + '" cy="' + cy + '" r="3.2" fill="#2563EB"/>' +
          '<text class="sw-node-title" x="' + tx + '" y="' + ty + '" text-anchor="' + textAnchor + '" fill="#243E6B" font-size="12" font-weight="600">' + (fogged ? '◇ ？？？' : '◇ 未启封') + '</text>' +
          '<text class="sw-node-sub" x="' + tx + '" y="' + subY + '" text-anchor="' + textAnchor + '" fill="#3A5685" font-size="11.5">' + (fogged ? '推进主线启封' : sub) + '</text>' +
        '</g>'
      );
    }

    return (
      '<div class="starweb-archive-box">' +
        '<svg class="causal-starweb-svg" viewBox="0 0 520 172" width="100%" height="172" role="img" aria-label="暗线线索星轨连线图">' +
          '<defs>' +
            '<filter id="sw-glow" x="-30%" y="-30%" width="160%" height="160%">' +
              '<feGaussianBlur stdDeviation="1.4" result="blur"/>' +
              '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>' +
            '</filter>' +
          '</defs>' +
          '<circle class="sw-ring-outer" cx="260" cy="86" r="70" fill="none" stroke="rgba(22,88,235,0.18)" stroke-width="1" stroke-dasharray="2 5"/>' +
          '<circle class="sw-ring-inner" cx="260" cy="86" r="42" fill="none" stroke="rgba(56,189,248,0.34)" stroke-width="1"/>' +
          '<line class="sw-axis" x1="20" y1="86" x2="500" y2="86" stroke="rgba(22,88,235,0.12)" stroke-width="1"/>' +
          '<line class="sw-axis" x1="260" y1="12" x2="260" y2="160" stroke="rgba(22,88,235,0.12)" stroke-width="1"/>' +
          // 中心枢纽连线
          threadLine(260, 86, 126, 42, n1, false) +
          threadLine(260, 86, 126, 130, n2, false) +
          threadLine(260, 86, 394, 42, n3, false) +
          threadLine(260, 86, 394, 130, n4, false) +
          // 同脉强共振连线（王都暗潮脉 / 极北旧风脉）
          threadLine(126, 42, 126, 130, darkTideLit, true) +
          threadLine(394, 42, 394, 130, northWindLit, true) +
          // 跨卷星轨细丝
          threadLine(126, 42, 394, 42, crossLit && n1 && n3, false) +
          threadLine(126, 130, 394, 130, crossLit && n2 && n4, false) +
          // 中央冰晶星盘核心
          '<g class="sw-core">' +
            '<circle class="sw-core-ring" cx="260" cy="86" r="21" fill="rgba(255,255,255,0.82)" stroke="#1658EB" stroke-width="1.7"/>' +
            '<polygon class="sw-core-star" points="260,71 264.8,81.2 275,86 264.8,90.8 260,101 255.2,90.8 245,86 255.2,81.2" fill="#1658EB" stroke="#FFFFFF" stroke-width="0.9" opacity="' + (litCount ? '0.98' : '0.84') + '"/>' +
            '<text class="sw-core-label" x="260" y="125" text-anchor="middle" fill="#0B1C3D" font-size="11.5" font-weight="700" letter-spacing="1">星轨枢纽 · ' + litCount + '/4</text>' +
          '</g>' +
          // 四枚暗线星标（未启封高剧透节点在前期以迷雾遮罩）
          clueNode(126, 42, n1, '宴席暗探', '巴依食单暗线', 'end', isNodeFogged('bayi_banquet_leak', n1)) +
          clueNode(126, 130, n2, '王都调防', '城郊封锁苗头', 'end', isNodeFogged('belmont_troop_shift', n2)) +
          clueNode(394, 42, n3, '北极铃兰', '恒温冰膜印记', 'start', isNodeFogged('polar_lily_bond', n3)) +
          clueNode(394, 130, n4, '院角老树', '故人「岚」之名', 'start', isNodeFogged('wind_god_echo', n4)) +
        '</svg>' +
      '</div>'
    );
  }

  function canOpenEndingForecast(targetS) {
    var st = targetS || getStateObj();
    if (!st) return false;
    if (root.RaisingHub && typeof root.RaisingHub.canOpenEndingForecast === 'function') {
      try { return !!root.RaisingHub.canOpenEndingForecast(st); } catch (e) {}
    }
    var f = st.flags || {};
    return st.phase === 'journey'
      || st.phase === 'finale'
      || !!(f.did_turnpoint || f.arrived_jikan || f.ch_distant_wind_1 || f.ch_leaky_cup || f.ch_interlude_white_night)
      || Number(st.ageY || 0) >= 15;
  }

  /**
   * 渲染面板专属标签页：「命运暗流 · 星轨档案」（冰晶星轨天球档案风格）
   * 注意：文案规避“记”+“忆”连用，保持既有面板标签测试 100% 兼容！
   */
  function renderCausalPanelHTML(targetS) {
    var st = targetS || getStateObj();
    var c = ensureCausalState(st);
    var tendency = getEndingTendency(st);
    var doneCount = Object.keys(c.vignettesDone || {}).length;
    var litClues = tendency.unlockedClues;
    var triggeredPayoffs = tendency.triggeredPayoffs;
    var ph = (st && st.phase) || 'prologue';
    var stFlags = (st && st.flags) || {};
    var isPreAcademy = (ph === 'prologue' || ph === 'childhood' || ph === 'youth');
    var isEarlyAcademyFog = (ph === 'academy' && litClues < 1 && triggeredPayoffs < 1 && tendency.totalAxisPoints < 2);
    var canForecast = canOpenEndingForecast(st);
    var maskTendency = !canForecast && (isPreAcademy || isEarlyAcademyFog);
    var HIGH_SPOILER_PAYOFFS = { dark_tide: true, rival_grace: true, northern_vow: true };

    var scalesHtml = Object.keys(AXIS_META).map(function (cid, idx) {
      var s = getAxisSummary(cid, st);
      var glyph = idx < 2 ? '✦' : '◈';
      var axisTotal = (s.leftVal || 0) + (s.rightVal || 0);
      var knownVal = (st && st.know && Number(st.know[cid] || 0)) || 0;
      var charFogged = axisTotal === 0 && knownVal <= 0 && (
        (isPreAcademy && cid !== 'alice') ||
        (cid === 'jilan' && ph !== 'journey' && ph !== 'finale' && !stFlags.arrived_jikan)
      );
      if (charFogged) {
        return (
          '<div class="astral-scale-card is-fogged" data-axis-char="' + cid + '">' +
            '<div class="as-header">' +
              '<span class="as-char"><i class="as-glyph">◇</i> <b>？？？ · 推进主线启封</b></span>' +
              '<span class="as-badge">未结识</span>' +
            '</div>' +
            '<div class="as-desc">此道羁绊星轨尚未启封，随主线推进结识对应人物后显现。</div>' +
          '</div>'
        );
      }
      var leftGlow = Math.max(8, 100 - s.ratio);
      var rightGlow = Math.max(8, s.ratio);
      return (
        '<div class="astral-scale-card" data-axis-char="' + cid + '">' +
          '<div class="as-header">' +
            '<span class="as-char"><i class="as-glyph">' + glyph + '</i> <b>' + s.name + '</b></span>' +
            '<span class="as-badge ' + s.dominant + '">当前弧光：' + s.dominantLabel + '</span>' +
          '</div>' +
          '<div class="as-poles">' +
            '<span class="as-pole left">' + s.leftLabel + ' <em>' + s.leftVal + '</em></span>' +
            '<span class="as-pole right"><em>' + s.rightVal + '</em> ' + s.rightLabel + '</span>' +
          '</div>' +
          '<div class="as-track">' +
            '<div class="as-fill-left" style="width:' + leftGlow + '%"></div>' +
            '<div class="as-fill-right" style="width:' + rightGlow + '%"></div>' +
            '<div class="as-star" style="left:' + s.ratio + '%">✦</div>' +
          '</div>' +
          '<div class="as-desc">' + (s.dominant === s.rightKey ? s.rightDesc : s.leftDesc) + '</div>' +
        '</div>'
      );
    }).join('');

    var starWebHtml = buildClueStarWebSVG(c, st);

    var cluesHtml = Object.keys(CLUE_META).map(function (ck) {
      var cm = CLUE_META[ck];
      var unlocked = !!c.clues[ck];
      var clueFogged = !unlocked && (
        isPreAcademy ||
        isEarlyAcademyFog ||
        (Array.isArray(cm.allowedPhases) && cm.allowedPhases.indexOf(ph) === -1)
      );
      return (
        '<div class="clue-tile ' + (unlocked ? 'lit' : 'dimmed') + (clueFogged ? ' is-fogged' : '') + '" data-clue="' + ck + '">' +
          '<div class="ct-head">' + (unlocked ? '<i class="as-glyph">✦</i> ' + cm.title : (clueFogged ? '<i class="as-glyph">◇</i> ？？？ · 推进主线启封' : '<i class="as-glyph">◇</i> 尚未启封的暗流档案')) + '</div>' +
          '<div class="ct-body">' + (unlocked ? cm.summary : (clueFogged ? '当前篇章尚无相关端倪，随主线推进至对应章节后启封线索提示。' : cm.hint)) + '</div>' +
        '</div>'
      );
    }).join('');

    var payoffsHtml = Object.keys(PAYOFF_META).map(function (pk) {
      var pm = PAYOFF_META[pk];
      var triggered = !!c.payoffsTriggered[pk];
      var ready = (pk === 'dark_tide' && canTriggerDarkTide(st))
        || (pk === 'rival_grace' && getCharlotteArcMode(st) !== 'default')
        || (pk === 'alice_arc' && getAliceArcMode(st) !== 'default')
        || (pk === 'noelle_arc' && getNoelleArcMode(st) !== 'default')
        || (pk === 'aino_arc' && getAinoArcMode(st) !== 'default')
        || (pk === 'northern_vow' && canTriggerNorthernVow(st));
      var payoffFogged = !triggered && !ready && (
        isPreAcademy ||
        isEarlyAcademyFog ||
        (ph === 'academy' && (
          HIGH_SPOILER_PAYOFFS[pk] ||
          (pk === 'aino_arc' && !(stFlags.met_aino || ((st && st.know && st.know.aino) || 0) > 0))
        ))
      );
      if (payoffFogged) {
        return (
          '<div class="payoff-row pending is-fogged" data-payoff="' + pk + '">' +
            '<div class="pr-top"><span><i class="as-glyph">◇</i> <b>？？？ · 推进主线启封</b></span><em class="pr-status">◇ 迷雾未散</em></div>' +
            '<div class="pr-desc">未启封的后章命运节点，随主线推进与暗流积累逐步揭晓。</div>' +
          '</div>'
        );
      }
      var badge = triggered ? '✦ 已引爆主线变向' : (ready ? '◈ 暗流已蓄满（待主线触发）' : '◇ 潜流积蓄中');
      var cls = triggered ? 'triggered' : (ready ? 'ready' : 'pending');
      return (
        '<div class="payoff-row ' + cls + '" data-payoff="' + pk + '">' +
          '<div class="pr-top"><span><i class="as-glyph">✦</i> <b>' + pm.title + '</b> <small>（' + pm.stage + '）</small></span><em class="pr-status">' + badge + '</em></div>' +
          '<div class="pr-desc">' + (triggered || ready ? pm.effectDesc : '解锁条件：' + pm.condDesc) + '</div>' +
        '</div>'
      );
    }).join('');

    var echoesHtml = c.echoes.length
      ? c.echoes.map(function (e) {
          var w = Math.max(1, Math.min(5, Math.round(Number(e.weight || 1))));
          var stars = '';
          for (var wi = 0; wi < w; wi++) stars += '★';
          return (
            '<div class="echo-chip" data-echo-weight="' + w + '">' +
              '<span class="ec-quote"><em class="ec-stars">' + stars + '</em>「' + escapeHtml(e.quote) + '」</span>' +
              '<span class="ec-meta">— ' + escapeHtml(e.speaker || '回响') + ' · ' + escapeHtml(e.context || '往昔') + '</span>' +
            '</div>'
          );
        }).join('')
      : '<p class="causal-empty">尚未留下高权重诺言。前往各地点带「✦」的小场景或开启灵魂交谈，你的话语将在重逢时回响。</p>';

    var tendencyCardHtml = maskTendency
      ? (
        '<div class="cd-tendency-card is-fogged" data-ending-tendency="fogged">' +
          '<div class="cd-tendency-head">' +
            '<span class="cd-tendency-title">◈ 终局星轨预兆 · ？？？ · 推进主线启封</span>' +
            '<div class="cd-tendency-actions">' +
              '<span class="cd-tendency-badge">星轨未明</span>' +
              '<button type="button" id="btn-open-ending-forecast" class="cd-forecast-btn" disabled title="推进主线启封终局星轨推演">' +
                '◇ ？？？ · 推进主线启封' +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="cd-tendency-summary">命运暗流尚处于初起阶段，推进主线剧情并点亮暗线拼图后，终局星轨的轮廓才会浮现。</div>' +
        '</div>'
      )
      : (
        '<div class="cd-tendency-card" data-ending-tendency="' + tendency.id + '">' +
          '<div class="cd-tendency-head">' +
            '<span class="cd-tendency-title">◈ 终局星轨预兆 · ' + escapeHtml(tendency.title) + '</span>' +
            '<div class="cd-tendency-actions">' +
              '<span class="cd-tendency-badge">' + escapeHtml(tendency.badge) + ' · 收束度 ' + tendency.confidence + '%</span>' +
              '<button type="button" id="btn-open-ending-forecast" class="cd-forecast-btn"' + (canForecast ? '' : ' disabled') +
                ' title="' + (canForecast ? '推演当前星轨指向的终局归宿' : '推进至第三卷后启封终局推演') + '">' +
                (canForecast ? '✦ 开启终局星轨推演 ▸' : '◇ 终局推演（第三卷启封）') +
              '</button>' +
            '</div>' +
          '</div>' +
          '<div class="cd-tendency-summary">' + escapeHtml(tendency.summary) + '</div>' +
        '</div>'
      );

    return (
      '<div class="causal-dashboard">' +
        '<div class="cd-banner">' +
          '<div><b>✦ 命运暗流 · 星轨档案</b><span>五组关系双轴、暗线星轨与高权重往昔回声在此交汇，折射终局分流</span></div>' +
          '<div class="cd-pills">' +
            '<span class="cd-pill">小场景 ' + doneCount + '/8</span>' +
            '<span class="cd-pill">星轨拼图 ' + litClues + '/4</span>' +
            '<span class="cd-pill">已变向 ' + triggeredPayoffs + '/6</span>' +
          '</div>' +
        '</div>' +
        tendencyCardHtml +
        '<h4 class="cd-sec-title">暗线星轨连线图</h4>' +
        starWebHtml +
        '<h4 class="cd-sec-title">关系双轴光轨（五重羁绊天平）</h4>' +
        '<div class="astral-scales-grid">' + scalesHtml + '</div>' +
        '<h4 class="cd-sec-title">暗线情报档案</h4>' +
        '<div class="clues-grid">' + cluesHtml + '</div>' +
        '<h4 class="cd-sec-title">主线蝴蝶效应台账</h4>' +
        '<div class="payoffs-list">' + payoffsHtml + '</div>' +
        '<h4 class="cd-sec-title">往昔回声留痕墙</h4>' +
        '<div class="echoes-list">' + echoesHtml + '</div>' +
      '</div>'
    );
  }

  function bindEndingForecastTrigger() {
    if (typeof document !== 'undefined' && !document.__bdForecastBound) {
      document.__bdForecastBound = true;
      document.addEventListener('click', function (ev) {
        var btn = ev && ev.target && ev.target.closest ? ev.target.closest('#btn-open-ending-forecast') : null;
        if (!btn || btn.disabled) return;
        if (typeof show === 'function') show('panel', 0);
        if (root.RaisingHub && typeof root.RaisingHub.showEndingScreen === 'function') {
          root.RaisingHub.showEndingScreen();
        } else if (typeof toast === 'function') {
          toast('✦ 终局星轨推演已就绪');
        }
      });
    }
  }

  /**
   * 绑定并挂载到游戏引擎
   */
  function attachToEngine() {
    bindEndingForecastTrigger();
    if (root.__branchingDirectorAttached) return;
    if (typeof SCENES === 'undefined' && (!root || !root.SCENES)) return;
    root.__branchingDirectorAttached = true;

    var scenesRef = typeof SCENES !== 'undefined' ? SCENES : root.SCENES;
    patchMacroPayoffsIntoScenes(scenesRef);
    ensureCausalState();

    // 钩入 doTalk：若当前地点有可玩暗流小场景，在交谈选择中一并提供
    if (typeof doTalk === 'function') {
      var origDoTalk = doTalk;
      var wrappedDoTalk = function () {
        var st = getStateObj();
        var vList = getAvailableVignettesHere(st);
        var peeps = typeof whoIsHere === 'function' ? whoIsHere() : [];
        if (!vList.length) return origDoTalk.apply(this, arguments);
        var choices = [];
        vList.forEach(function (v) {
          choices.push({
            text: '✦【日常暗流】' + v.title,
            do: function () { runScene(v.id); }
          });
        });
        peeps.forEach(function (id) {
          choices.push({
            text: '和' + ((typeof CHARS !== 'undefined' && CHARS[id] && CHARS[id].short) || id) + '日常寒暄',
            do: function () { talkTo(id); }
          });
        });
        choices.push({ text: '暂时作罢', do: function () { enterFreeRoam(); } });
        playLines([{ text: '空气里似乎流动着值得留步聊聊的契机——', choices: choices }]);
      };
      doTalk = wrappedDoTalk;
      root.doTalk = wrappedDoTalk;
    }

    // 钩入 openLetterDemo：动态根据爱丽丝双轴倾向与回声展示信件正文
    if (typeof openLetterDemo === 'function') {
      var origOpenLetter = openLetterDemo;
      var wrappedOpenLetter = function () {
        syncAliceLetterDOM();
        return origOpenLetter.apply(this, arguments);
      };
      openLetterDemo = wrappedOpenLetter;
      root.openLetterDemo = wrappedOpenLetter;
    }
  }

  var API = {
    AXIS_META: AXIS_META,
    CLUE_META: CLUE_META,
    PAYOFF_META: PAYOFF_META,
    VIGNETTE_CATALOG: VIGNETTE_CATALOG,
    STAGE_EMO_BADGES: STAGE_EMO_BADGES,
    createDefaultCausal: createDefaultCausal,
    ensureCausalState: ensureCausalState,
    syncStageEmotionBadge: syncStageEmotionBadge,
    shiftAxis: shiftAxis,
    unlockClue: unlockClue,
    recordEcho: recordEcho,
    getEchoFor: getEchoFor,
    getAxisSummary: getAxisSummary,
    canTriggerDarkTide: canTriggerDarkTide,
    canTriggerRivalGrace: canTriggerRivalGrace,
    getCharlotteArcMode: getCharlotteArcMode,
    getAliceArcMode: getAliceArcMode,
    getNoelleArcMode: getNoelleArcMode,
    getAinoArcMode: getAinoArcMode,
    canTriggerNorthernVow: canTriggerNorthernVow,
    getEndingTendency: getEndingTendency,
    canOpenEndingForecast: canOpenEndingForecast,
    getCausalDialogueHooks: getCausalDialogueHooks,
    applyAIOutcome: applyAIOutcome,
    getCausalSnapshot: getCausalSnapshot,
    getAvailableVignettesHere: getAvailableVignettesHere,
    renderVignetteHotspots: renderVignetteHotspots,
    renderCausalPanelHTML: renderCausalPanelHTML,
    patchMacroPayoffsIntoScenes: patchMacroPayoffsIntoScenes,
    syncAliceLetterDOM: syncAliceLetterDOM,
    attachToEngine: attachToEngine
  };

  root.BranchingDirector = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }

  bindEndingForecastTrigger();
  if (typeof window !== 'undefined' && (typeof SCENES !== 'undefined' || window.SCENES)) {
    attachToEngine();
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
