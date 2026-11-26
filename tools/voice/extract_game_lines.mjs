#!/usr/bin/env node
/**
 * tools/voice/extract_game_lines.mjs
 *
 * 通过 Node `vm` 沙盒直接执行游戏运行期脚本（零脆弱正则拆剧本），
 * 严格遵循 `tools/voice/casting_fish_audio.json` SSOT 契约，精准抽取全游戏语音点位，
 * 并输出为 6 个平衡批次文件 + `extraction_summary.json` 至 `tools/voice/raw_extracted/`。
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const CASTING_PATH = path.join(__dirname, 'casting_fish_audio.json');
const OUT_DIR = path.join(__dirname, 'raw_extracted');

// =========================================================================
// 一、SSOT 文本归一化与 FNV-1a 32位哈希（必须与 js/voice-engine.js 逐比特一致）
// =========================================================================
export function normalizeVoiceText(s) {
  return String(s || '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u3000\s]+/g, ' ')
    .trim();
}

export function fnv1aHex(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function makeStoryVoiceId(sceneId, charId, text) {
  const norm = normalizeVoiceText(text);
  return `${sceneId}__${charId}__${fnv1aHex(`${charId}|${norm}`)}`;
}

export function makeInteractiveVoiceId(kind, charId, text) {
  const norm = normalizeVoiceText(text);
  return `inter__${kind}__${charId}__${fnv1aHex(`${charId}|${norm}`)}`;
}

export function makeCombatVoiceId(cueKey) {
  return `combat__${cueKey}`;
}

const PURE_PAREN_ACTION_RE = /^（[\s\S]*）$/;
const MYSTERY_SPEAKER_RE = /^[？?]+$/;

// =========================================================================
// 二、最小 DOM / Browser API Mock + Node `vm` 沙盒
// =========================================================================
function createMinimalDomSandbox() {
  const elementsById = new Map();

  function makeClassList(initial = []) {
    const set = new Set(initial);
    return {
      add(...cls) { cls.forEach(c => c && set.add(c)); },
      remove(...cls) { cls.forEach(c => set.delete(c)); },
      toggle(c, force) {
        if (force === undefined) {
          if (set.has(c)) { set.delete(c); return false; }
          set.add(c); return true;
        }
        if (force) set.add(c); else set.delete(c);
        return !!force;
      },
      contains(c) { return set.has(c); },
      toString() { return [...set].join(' '); },
    };
  }

  function createMockElement(tagName = 'div', id = '') {
    const attrs = new Map();
    if (id) attrs.set('id', id);
    const children = [];
    const el = {
      tagName: String(tagName).toUpperCase(),
      id,
      className: '',
      classList: makeClassList(),
      style: {
        setProperty(k, v) { this[k] = String(v); },
        removeProperty(k) { delete this[k]; },
        getPropertyValue(k) { return this[k] || ''; },
      },
      dataset: {},
      children,
      childNodes: children,
      parentNode: null,
      textContent: '',
      innerHTML: '',
      value: '',
      disabled: false,
      width: 1440,
      height: 900,
      clientWidth: 1440,
      clientHeight: 900,
      offsetWidth: 1440,
      offsetHeight: 900,
      scrollTop: 0,
      scrollHeight: 0,
      onclick: null,
      onkeydown: null,
      onerror: null,
      onload: null,
      setAttribute(k, v) {
        attrs.set(k, String(v));
        if (k === 'id') {
          el.id = String(v);
          elementsById.set(el.id, el);
        }
      },
      getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null; },
      removeAttribute(k) { attrs.delete(k); },
      hasAttribute(k) { return attrs.has(k); },
      appendChild(child) {
        if (child) {
          child.parentNode = el;
          children.push(child);
        }
        return child;
      },
      removeChild(child) {
        const idx = children.indexOf(child);
        if (idx >= 0) children.splice(idx, 1);
        if (child) child.parentNode = null;
        return child;
      },
      remove() {
        if (el.parentNode) el.parentNode.removeChild(el);
      },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      closest() { return null; },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return true; },
      focus() {},
      blur() {},
      click() { if (typeof el.onclick === 'function') el.onclick({ preventDefault() {}, stopPropagation() {} }); },
      getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 40, right: 100, bottom: 40 }; },
      getContext() { return null; },
    };
    return el;
  }

  function getOrCreateById(id) {
    if (!elementsById.has(id)) {
      const el = createMockElement('div', id);
      if (id === 'title-screen') el.classList.add('hidden');
      elementsById.set(id, el);
    }
    return elementsById.get(id);
  }

  const body = createMockElement('body', 'mock-body');
  const head = createMockElement('head', 'mock-head');
  const documentElement = createMockElement('html', 'mock-html');

  const doc = {
    readyState: 'complete',
    body,
    head,
    documentElement,
    title: '',
    hidden: false,
    visibilityState: 'visible',
    activeElement: body,
    getElementById: (id) => getOrCreateById(id),
    createElement: (tag) => createMockElement(tag),
    createTextNode: (txt) => ({ nodeType: 3, textContent: String(txt || '') }),
    createDocumentFragment: () => createMockElement('fragment'),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
  };

  const storageMap = new Map();
  const mockStorage = {
    getItem: (k) => (storageMap.has(String(k)) ? storageMap.get(String(k)) : null),
    setItem: (k, v) => { storageMap.set(String(k), String(v)); },
    removeItem: (k) => { storageMap.delete(String(k)); },
    clear: () => { storageMap.clear(); },
    key: (i) => [...storageMap.keys()][i] ?? null,
    get length() { return storageMap.size; },
  };

  class MockAudio {
    constructor(src = '') {
      this.src = src;
      this.volume = 1;
      this.muted = false;
      this.loop = false;
      this.paused = true;
      this.currentTime = 0;
      this.preload = 'auto';
    }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    addEventListener() {}
    removeEventListener() {}
  }

  class MockImage {
    constructor() { this.src = ''; this.complete = false; }
  }

  const mkParam = (v = 0) => ({
    value: v,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    linearRampToValueAtTime() {},
    setTargetAtTime() {},
    cancelScheduledValues() {},
  });

  class MockAudioContext {
    constructor() {
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.state = 'running';
      this.destination = { connect() {} };
    }
    resume() { return Promise.resolve(); }
    createOscillator() { return { type: 'sine', frequency: mkParam(440), detune: mkParam(0), connect() { return this; }, disconnect() {}, start() {}, stop() {} }; }
    createGain() { return { gain: mkParam(1), connect() { return this; }, disconnect() {} }; }
    createBiquadFilter() { return { type: 'lowpass', frequency: mkParam(1000), Q: mkParam(1), gain: mkParam(0), connect() { return this; }, disconnect() {} }; }
    createDynamicsCompressor() { return { threshold: mkParam(-24), knee: mkParam(30), ratio: mkParam(12), attack: mkParam(0.003), release: mkParam(0.25), connect() { return this; }, disconnect() {} }; }
    createBuffer(ch = 1, len = 1, sr = 44100) {
      const bufs = Array.from({ length: Math.max(1, ch) }, () => new Float32Array(Math.max(1, len)));
      return { numberOfChannels: bufs.length, length: Math.max(1, len), sampleRate: sr, getChannelData(i) { return bufs[i] || bufs[0]; } };
    }
    createBufferSource() { return { buffer: null, loop: false, playbackRate: mkParam(1), connect() { return this; }, disconnect() {}, start() {}, stop() {} }; }
    createStereoPanner() { return { pan: mkParam(0), connect() { return this; }, disconnect() {} }; }
  }

  let nextTimerId = 1;
  const sandbox = {
    console: {
      log() {},
      info() {},
      warn() {},
      error(...args) { console.error('[vm]', ...args); },
      debug() {},
    },
    document: doc,
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    navigator: { userAgent: 'jsdom-voice-extractor/1.0', language: 'zh-CN' },
    location: { href: 'http://localhost/', protocol: 'http:', host: 'localhost', pathname: '/', search: '', hash: '' },
    history: { replaceState() {}, pushState() {} },
    innerWidth: 1440,
    innerHeight: 900,
    devicePixelRatio: 1,
    Audio: MockAudio,
    Image: MockImage,
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext,
    CustomEvent: class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    Event: class Event { constructor(type) { this.type = type; } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; },
    requestAnimationFrame: () => nextTimerId++,
    cancelAnimationFrame() {},
    setTimeout: () => nextTimerId++,
    clearTimeout() {},
    setInterval: () => nextTimerId++,
    clearInterval() {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    performance: { now: () => Date.now() },
    URL,
    URLSearchParams,
    Intl,
    Math,
    Date,
    JSON,
    Object,
    Array,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Promise,
    RegExp,
    Error,
    TypeError,
    Number,
    String,
    Boolean,
    Symbol,
    Float32Array,
    Uint8Array,
    Int32Array,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    encodeURIComponent,
    decodeURIComponent,
    alert() {},
    confirm: () => true,
  };

  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.top = sandbox;
  sandbox.parent = sandbox;

  const ctx = vm.createContext(sandbox);

  function loadScript(relPath) {
    const abs = path.join(ROOT, relPath);
    const code = fs.readFileSync(abs, 'utf8');
    vm.runInContext(code, ctx, { filename: relPath });
  }

  return { ctx, loadScript };
}

// =========================================================================
// 三、主线 41 场景分卷配置（与 STORY_CHAPTERS 严格对齐，均匀切分 4 批）
// =========================================================================
const VOL_BATCH_MAP = {
  // 第一卷前半（0–5 岁：序章银与蓝 ～ 三姐妹的岁月）
  s_start:            { batch: 'batch_vol1a', volume: 'vol1a' },
  s_first_word:       { batch: 'batch_vol1a', volume: 'vol1a' },
  s_alice_born:       { batch: 'batch_vol1a', volume: 'vol1a' },
  s_child_days:       { batch: 'batch_vol1a', volume: 'vol1a' },
  s_age4:             { batch: 'batch_vol1a', volume: 'vol1a' },
  s_yaoshen:          { batch: 'batch_vol1a', volume: 'vol1a' },
  s_sisters_grow:     { batch: 'batch_vol1a', volume: 'vol1a' },
  s_tier1_story:      { batch: 'batch_vol1a', volume: 'vol1a' },
  s_child_hub:        { batch: 'batch_vol1a', volume: 'vol1a' },

  // 第一卷后半（6–10 岁：浪人叔叔 ～ 贝阿特丽丝离巢）
  s_reno_arrive:      { batch: 'batch_vol1b', volume: 'vol1b' },
  s_alice_affinity:   { batch: 'batch_vol1b', volume: 'vol1b' },
  s_beatrice_day:     { batch: 'batch_vol1b', volume: 'vol1b' },
  s_micro:            { batch: 'batch_vol1b', volume: 'vol1b' },
  s_alice_wind_teach: { batch: 'batch_vol1b', volume: 'vol1b' },
  s_beatrice_leaves:  { batch: 'batch_vol1b', volume: 'vol1b' },

  // 第二卷 魔法大学篇（12–15 岁：离巢启程 ～ 转折点一）
  s_academy_start:    { batch: 'batch_vol2', volume: 'vol2' },
  s_opening_ceremony: { batch: 'batch_vol2', volume: 'vol2' },
  s_noelle_meet:      { batch: 'batch_vol2', volume: 'vol2' },
  s_aino_meet:        { batch: 'batch_vol2', volume: 'vol2' },
  s_charlotte_meet:   { batch: 'batch_vol2', volume: 'vol2' },
  s_helena:           { batch: 'batch_vol2', volume: 'vol2' },
  s_aino_sparring:    { batch: 'batch_vol2', volume: 'vol2' },
  s_ajun:             { batch: 'batch_vol2', volume: 'vol2' },
  s_huke:             { batch: 'batch_vol2', volume: 'vol2' },
  s_ice_melt_1:       { batch: 'batch_vol2', volume: 'vol2' },
  s_seven_mountains:  { batch: 'batch_vol2', volume: 'vol2' },
  s_ice_melt_2:       { batch: 'batch_vol2', volume: 'vol2' },
  s_beach:            { batch: 'batch_vol2', volume: 'vol2' },
  s_tree:             { batch: 'batch_vol2', volume: 'vol2' },
  s_star_festival:    { batch: 'batch_vol2', volume: 'vol2' },
  s_turnpoint:        { batch: 'batch_vol2', volume: 'vol2' },

  // 第三卷 旅途篇 + 间章《白昼里的夜》
  s_black_name:            { batch: 'batch_vol3_4', volume: 'vol3' },
  s_jikan_arrive:          { batch: 'batch_vol3_4', volume: 'vol3' },
  s_north_forest:          { batch: 'batch_vol3_4', volume: 'vol3' },
  s_glow_sheep:            { batch: 'batch_vol3_4', volume: 'vol3' },
  s_distant_wind_1:        { batch: 'batch_vol3_4', volume: 'vol3' },
  s_words_to_wind:         { batch: 'batch_vol3_4', volume: 'vol3' },
  s_eye_of_storm:          { batch: 'batch_vol3_4', volume: 'vol3' },
  s_leaky_cup:             { batch: 'batch_vol3_4', volume: 'vol3' },
  s_interlude_white_night: { batch: 'batch_vol3_4', volume: 'vol4_interlude' },
  s_ending_menu:           { batch: 'batch_vol3_4', volume: 'vol3' },
};

// =========================================================================
// 四、战斗短语音标准台本（严格 1:1 对齐 CombatEngine.SKILLS 与 cueKey 契约）
// =========================================================================
const SYLVIA_SYSTEM_COMBAT_LINES = [
  { cueKey: 'amp_tier_1',       emo: 'serious', zh_text: '魔力盈溢……足够了。',               context_prev: '战斗：魔力增幅一阶（20%·魔力盈溢）蓄力' },
  { cueKey: 'amp_tier_2',       emo: 'serious', zh_text: '极寒过载。冻结它。',               context_prev: '战斗：魔力增幅二阶（40%·极寒过载）蓄力' },
  { cueKey: 'amp_tier_3',       emo: 'serious', zh_text: '星霜极限——全数收束。',             context_prev: '战斗：魔力增幅三阶（60%·星霜极限）满载' },
  { cueKey: 'eclipse_wand',     emo: 'serious', zh_text: '晦轮杖，开启。',                   context_prev: '战斗：激活晦轮杖 100% 魔法真伤' },
  { cueKey: 'insight_success',  emo: 'serious', zh_text: '看穿了。破绽在这里。',             context_prev: '战斗：冰晶宫殿两步看破推演成功' },
  { cueKey: 'interrupt',        emo: 'serious', zh_text: '节奏断了。',                       context_prev: '战斗：隔空瞬凝截断敌方咏唱 / 破招' },
  { cueKey: 'parry',            emo: 'serious', zh_text: '卸开了。轮到我了。',               context_prev: '战斗：生根步卸力闪反 / 斩风瞬反' },
  { cueKey: 'one_more',         emo: 'serious', zh_text: '还没结束，再进一步。',             context_prev: '战斗：弱点破锁触发 ONE MORE 追击' },
  { cueKey: 'player_hit',       emo: 'sad',     zh_text: '唔……',                             context_prev: '战斗：希尔维亚受轻伤' },
  { cueKey: 'player_hit_heavy', emo: 'sad',     zh_text: '唔……这一击挺重的。',               context_prev: '战斗：希尔维亚受重击' },
  { cueKey: 'shield_block',     emo: 'normal',  zh_text: '挡住了。',                         context_prev: '战斗：冰盾/水幕完全抵消敌方攻击' },
  { cueKey: 'dodge',            emo: 'normal',  zh_text: '落空了。',                         context_prev: '战斗：风行残像闪避敌方攻击' },
  { cueKey: 'victory_s',        emo: 'smile',   zh_text: '干净利落。回去喝杯茶吧。',         context_prev: '战斗：S 级完胜结算' },
  { cueKey: 'victory',          emo: 'normal',  zh_text: '结束了。辛苦了。',                 context_prev: '战斗：常规胜利结算' },
  { cueKey: 'defeat',           emo: 'sad',     zh_text: '……算漏了一步。得先撤了。',         context_prev: '战斗：落败撤退' },
];

const SYLVIA_SKILL_CHANTS = {
  basic_attack:            { emo: 'normal',  zh_text: '退下。' },
  hand_water_surge:        { emo: 'serious', zh_text: '覆潮水弹。' },
  hand_ice_crystal:        { emo: 'serious', zh_text: '凝华冰晶。' },
  hand_ice_wall:           { emo: 'normal',  zh_text: '凝水厚冰墙，立。' },
  hand_frost_floor:        { emo: 'normal',  zh_text: '蔓地薄冰，铺开。' },
  hand_root_shield:        { emo: 'serious', zh_text: '入地生根，钢冰盾。' },
  hand_water_veil:         { emo: 'normal',  zh_text: '折射水幕，展开。' },
  hand_thorn_field:        { emo: 'serious', zh_text: '冰棘群刺阵——起。' },
  remote_blind_shot:       { emo: 'serious', zh_text: '盲区……就是这里。' },
  remote_snap_spike:       { emo: 'serious', zh_text: '瞬凝，断咏。' },
  sword_root_step:         { emo: 'serious', zh_text: '生根步，沉身卸力。' },
  sword_water_edge:        { emo: 'serious', zh_text: '覆水极薄刃，送刀。' },
  sword_wind_afterimage:   { emo: 'normal',  zh_text: '风行残像。' },
  insight_beatrice_pillar: { emo: 'serious', zh_text: '右肩抬起来了——地下冰柱。' },
  insight_rowan_prism:     { emo: 'serious', zh_text: '双镜合拢，夹住杖身。' },
  insight_alice_cage:      { emo: 'serious', zh_text: '锁死左侧风轨——十字冰栏。' },
  insight_aino_bead:       { emo: 'serious', zh_text: '体侧三十公分——冰珠。' },
  insight_noelle_sever:    { emo: 'serious', zh_text: '脚底暗流——彻底冻绝。' },
  insight_jackal_throat:   { emo: 'serious', zh_text: '腾空无处借力——覆水封喉。' },
  insight_hulan_resonance: { emo: 'serious', zh_text: '腹下晶核——拜托了，艾诺。' },
  insight_eastwing_draft:  { emo: 'serious', zh_text: '借仆道冷风——冲溃铁幕。' },
  insight_wind_stillness:  { emo: 'serious', zh_text: '风眼静滞的刹那——贯入。' },
  insight_generic_flaw:    { emo: 'serious', zh_text: '凝霜贯隙，就是此刻。' },
};

const AINO_SPEAR_LINE = {
  cueKey: 'aino_spear',
  charId: 'aino',
  speaker: '艾诺',
  emo: 'serious',
  zh_text: '……破绽开了。冻碎它。',
  context_prev: '赫兰冰封峡谷：崖顶艾诺极寒冰枪协同狙击',
};

// =========================================================================
// 五、核心抽取流程
// =========================================================================
function extractBracketQuote(str) {
  const m = String(str || '').match(/「([^」]+)」/);
  return m ? m[1] : '';
}

function resolveSpeakerCharId(L, sceneId, casting) {
  const aliases = casting.speakerAliases || {};
  const spk = String(L.speaker || '').trim();
  const activePortrait = Array.isArray(L.portraits)
    ? L.portraits.find((p) => p && p.active !== false)
    : null;
  const activeId = activePortrait ? activePortrait.id : null;

  // 1. 家庭教师特例（s_sisters_grow 中 ch:'lecturer' 但 speaker:'家庭教师'）
  if (spk === '家庭教师') return 'teacher';

  // 2. 霁清成年/少年区分（s_eye_of_storm 求婚段立绘为 ji，少年送信段为 jiqing）
  if (spk === '霁清') {
    if (activeId === 'ji' || L.ch === 'ji') return 'ji';
    return 'jiqing';
  }

  // 3. ？？？ 神秘名牌按 ch -> active portrait -> 场景上下文精准识别
  if (MYSTERY_SPEAKER_RE.test(spk)) {
    if (L.ch) return L.ch;
    if (activeId) return activeId;
    if (sceneId === 's_yaoshen') return 'yaoshen';
    if (sceneId === 's_start') return 'sophia';
    return null;
  }

  // 4. 别名映射优先
  if (spk && aliases[spk]) return aliases[spk];

  // 5. ch 字段兜底
  if (L.ch) return L.ch;

  // 6. active 立绘兜底
  if (activeId) return activeId;

  return null;
}

function resolveLineEmo(L, charId) {
  if (L.emo) return String(L.emo);
  if (Array.isArray(L.portraits)) {
    const exact = L.portraits.find((p) => p && p.id === charId && p.active !== false);
    if (exact && exact.emo) return String(exact.emo);
    const anyAct = L.portraits.find((p) => p && p.active !== false);
    if (anyAct && anyAct.emo) return String(anyAct.emo);
  }
  return 'normal';
}

function isExplicitMonoLine(L) {
  return (
    !L.speaker &&
    !L.ch &&
    Array.isArray(L.portraits) &&
    L.portraits.length === 1 &&
    L.portraits[0] &&
    L.portraits[0].slot === 'center' &&
    L.portraits[0].active === true
  );
}

function formatPrevContext(prevObj) {
  if (!prevObj || !prevObj.text) return '';
  const clean = normalizeVoiceText(prevObj.text);
  const clipped = clean.length > 110 ? `${clean.slice(0, 110)}…` : clean;
  return prevObj.speaker ? `${prevObj.speaker}: ${clipped}` : `旁白: ${clipped}`;
}

function main() {
  const casting = JSON.parse(fs.readFileSync(CASTING_PATH, 'utf8'));
  const charIdToProfile = casting.charIdToProfileId || {};

  // 校验 25 套配置零主键撞车
  const primaryIds = new Set();
  for (const p of casting.profiles) {
    if (primaryIds.has(p.primary.id)) {
      throw new Error(`Duplicate primary Fish Audio model id: ${p.primary.id} (${p.profileId})`);
    }
    primaryIds.add(p.primary.id);
  }

  const { ctx, loadScript } = createMinimalDomSandbox();

  // ---- Phase 1: 载入纯主线剧本与核心引擎（BranchingDirector 挂载前） ----
  for (const rel of [
    'js/story.js',
    'js/story-vol3.js',
    'js/story-vol4.js',
    'js/ai-personas.js',
    'game.js',
  ]) {
    loadScript(rel);
  }

  const SCENES = ctx.SCENES;
  const CHARS = ctx.CHARS;
  const mainlineSceneIds = Object.keys(SCENES);

  // 校验所有主线场景均已落入 4 个分卷映射表
  const unmappedScenes = mainlineSceneIds.filter((id) => !VOL_BATCH_MAP[id]);
  if (unmappedScenes.length > 0) {
    throw new Error(`Mainline scenes missing from VOL_BATCH_MAP: ${unmappedScenes.join(', ')}`);
  }

  // 记录 Phase 1 原生行对象引用，用于 Phase 2 精准识别 BranchingDirector 织入的蝴蝶效应行
  const mainlineLineObjSet = new WeakSet();
  function markObjRefs(lines) {
    if (!Array.isArray(lines)) return;
    for (const L of lines) {
      if (L && typeof L === 'object') {
        mainlineLineObjSet.add(L);
        if (Array.isArray(L.choices)) {
          for (const c of L.choices) {
            if (c && Array.isArray(c.lines)) markObjRefs(c.lines);
          }
        }
      }
    }
  }
  for (const sid of mainlineSceneIds) {
    markObjRefs(SCENES[sid].lines);
  }

  const batches = {
    batch_vol1a: [],
    batch_vol1b: [],
    batch_vol2: [],
    batch_vol3_4: [],
    batch_combat_mono: [],
    batch_interactive: [],
  };

  const globalSeenVoiceIds = new Map(); // voiceId -> { batch, entry }
  const unmappedWarnings = [];
  const skippedParenthesized = [];
  const dedupStats = {
    rawTotal: 0,
    uniqueTotal: 0,
    duplicatesCollapsed: 0,
    byCategory: {},
  };

  function bumpCategory(cat, isDup) {
    if (!dedupStats.byCategory[cat]) {
      dedupStats.byCategory[cat] = { raw: 0, unique: 0, collapsed: 0 };
    }
    dedupStats.byCategory[cat].raw += 1;
    dedupStats.rawTotal += 1;
    if (isDup) {
      dedupStats.byCategory[cat].collapsed += 1;
      dedupStats.duplicatesCollapsed += 1;
    } else {
      dedupStats.byCategory[cat].unique += 1;
      dedupStats.uniqueTotal += 1;
    }
  }

  function pushRecord(batchName, category, rec) {
    const profileId = charIdToProfile[rec.charId] || null;
    if (!profileId) {
      unmappedWarnings.push({
        reason: 'missing_profileId',
        batch: batchName,
        category,
        sceneId: rec.sceneId || null,
        lineIdx: rec.lineIdx || null,
        charId: rec.charId,
        speaker: rec.speaker,
        zh_text: rec.zh_text,
      });
    }
    rec.profileId = profileId;
    if (!rec.audioRelPath && rec.audioPath) {
      rec.audioRelPath = rec.audioPath.startsWith('assets/voice/')
        ? rec.audioPath.slice('assets/voice/'.length)
        : rec.audioPath;
    }

    const existing = globalSeenVoiceIds.get(rec.voiceId);
    if (existing) {
      existing.entry.occurrences = (existing.entry.occurrences || 1) + 1;
      if (rec.lineIdx != null) {
        existing.entry.extraLineIndices = existing.entry.extraLineIndices || [];
        existing.entry.extraLineIndices.push(`${rec.sceneId || ''}:${rec.lineIdx}`);
      }
      bumpCategory(category, true);
      return false;
    }

    globalSeenVoiceIds.set(rec.voiceId, { batch: batchName, entry: rec });
    batches[batchName].push(rec);
    bumpCategory(category, false);
    return true;
  }

  // ---- 1 & 2. 抽取主线 41 场景净角色说话台词 + 显式 MONO 独白 ----
  const orderedMainlineIds = Object.keys(VOL_BATCH_MAP).filter((id) => !!SCENES[id]);

  function walkMainlineLines(sceneId, meta, lines, prefix = '', inheritedPrev = null) {
    if (!Array.isArray(lines)) return;
    let prev = inheritedPrev;

    lines.forEach((L, idx) => {
      if (typeof L === 'string') {
        prev = { speaker: null, text: L };
        return;
      }
      if (!L || typeof L !== 'object') return;
      const lineIdx = prefix ? `${prefix}.${idx}` : `${idx}`;
      const rawText = typeof L.text === 'function' ? String(L.text() || '') : (typeof L.text === 'string' ? L.text : '');
      const trimmed = rawText.trim();

      if (trimmed) {
        if (L.speaker || L.ch) {
          if (PURE_PAREN_ACTION_RE.test(trimmed)) {
            skippedParenthesized.push({
              scope: 'mainline',
              sceneId,
              lineIdx,
              speaker: L.speaker || null,
              ch: L.ch || null,
              zh_text: trimmed,
            });
          } else {
            const charId = resolveSpeakerCharId(L, sceneId, casting);
            if (!charId) {
              unmappedWarnings.push({
                reason: 'unresolvable_speaker',
                sceneId,
                lineIdx,
                speaker: L.speaker || null,
                ch: L.ch || null,
                zh_text: trimmed,
              });
            } else {
              const speakerLabel = L.speaker || (CHARS[charId] && CHARS[charId].short) || charId;
              const normText = normalizeVoiceText(rawText);
              const voiceId = makeStoryVoiceId(sceneId, charId, normText);
              pushRecord(meta.batch, 'main', {
                voiceId,
                audioPath: `assets/voice/story/${sceneId}/${voiceId}.mp3`,
                volume: meta.volume,
                sceneId,
                lineIdx,
                charId,
                profileId: null,
                speaker: speakerLabel,
                emo: resolveLineEmo(L, charId),
                tier: 'main',
                zh_text: normText,
                context_prev: formatPrevContext(prev),
              });
            }
          }
        } else if (isExplicitMonoLine(L)) {
          if (!PURE_PAREN_ACTION_RE.test(trimmed)) {
            const charId = L.portraits[0].id;
            const speakerLabel = (CHARS[charId] && CHARS[charId].short) || charId;
            const normText = normalizeVoiceText(rawText);
            const voiceId = makeStoryVoiceId(sceneId, charId, normText);
            pushRecord('batch_combat_mono', 'mono', {
              voiceId,
              audioPath: `assets/voice/story/${sceneId}/${voiceId}.mp3`,
              volume: meta.volume,
              sceneId,
              lineIdx,
              charId,
              profileId: null,
              speaker: speakerLabel,
              emo: L.portraits[0].emo || 'normal',
              tier: 'mono',
              zh_text: normText,
              context_prev: formatPrevContext(prev),
            });
          }
        }
        prev = {
          speaker: L.speaker || (L.ch && CHARS[L.ch] ? CHARS[L.ch].short : null),
          text: rawText,
        };
      }

      if (Array.isArray(L.choices)) {
        L.choices.forEach((choice, ci) => {
          if (choice && Array.isArray(choice.lines)) {
            const choicePrev = { speaker: '选项', text: choice.text || '' };
            walkMainlineLines(sceneId, meta, choice.lines, `${lineIdx}.c${ci}`, choicePrev);
          }
        });
      }
    });
  }

  for (const sid of orderedMainlineIds) {
    walkMainlineLines(sid, VOL_BATCH_MAP[sid], SCENES[sid].lines);
  }

  // ---- 4c. 自由探索问候 roamGreetingText (kind: roam_greet) ----
  const PROBE_LOC = '__VOICE_PROBE_NO_LOC__';
  const PROBE_DETAIL_SUFFIX = '这里今天很安静。';
  const roamAges = [0, 1, 2, 4, 6, 8, 10, 12, 15];
  const allCharIds = Object.keys(CHARS);
  const seenGreetProbe = new Set();

  for (const charId of allCharIds) {
    for (const age of roamAges) {
      for (const dwFlag of [0, 1]) {
        ctx.S.ageY = age;
        ctx.S.flags = dwFlag ? { ch_distant_wind_1: 1 } : {};
        const full = String(ctx.roamGreetingText(charId, PROBE_LOC) || '');
        const core = full.endsWith(PROBE_DETAIL_SUFFIX)
          ? full.slice(0, full.length - PROBE_DETAIL_SUFFIX.length).trim()
          : full.trim();
        // 过滤 default 分支的第三人称旁白（非角色开口台词）
        if (!core || core.endsWith('弯下身向你打了声招呼。') || core.endsWith('向你点了点头。')) {
          continue;
        }
        const normText = normalizeVoiceText(core);
        const probeKey = `${charId}|${normText}`;
        if (seenGreetProbe.has(probeKey)) continue;
        seenGreetProbe.add(probeKey);
        const voiceId = makeInteractiveVoiceId('roam_greet', charId, normText);
        pushRecord('batch_interactive', 'interactive_roam_greet', {
          voiceId,
          audioPath: `assets/voice/interactive/roam_greet/${voiceId}.mp3`,
          tier: 'interactive',
          kind: 'roam_greet',
          charId,
          profileId: null,
          speaker: CHARS[charId]?.short || charId,
          emo: 'normal',
          zh_text: normText,
          context_prev: `自由探索进入地点问候（age=${age}${dwFlag ? ', 前线阶段' : ''}）`,
        });
      }
    }
  }

  // ---- 4d. 自由探索交谈 talkLines (kind: roam_talk) ----
  const origRandom = ctx.Math.random;
  const talkAges = [0, 1, 2, 4, 6, 8, 10, 12, 15];
  const talkStates = [
    { loc: 'nursery', flags: {}, causal: { clues: {}, axes: {} } },
    { loc: 'garden', flags: { ch_alice_born: 1 }, causal: { clues: {}, axes: {} } },
    { loc: 'ice_canyon', flags: { ch_distant_wind_1: 1 }, causal: { clues: { polar_lily_bond: true }, axes: { aino: { kinship: 3 } } } },
  ];
  const seenTalkProbe = new Set();

  for (const charId of allCharIds) {
    for (const age of talkAges) {
      for (const stCfg of talkStates) {
        ctx.S.ageY = age;
        ctx.S.loc = stCfg.loc;
        ctx.S.flags = Object.assign({}, stCfg.flags);
        ctx.S.causal = JSON.parse(JSON.stringify(stCfg.causal));
        for (let step = 0; step < 20; step++) {
          ctx.Math.random = () => (step + 0.01) / 20;
          const lines = ctx.talkLines(charId);
          if (!Array.isArray(lines)) continue;
          let prev = null;
          for (const L of lines) {
            if (!L || typeof L !== 'object' || typeof L.text !== 'string') continue;
            const trimmed = L.text.trim();
            if (!trimmed || PURE_PAREN_ACTION_RE.test(trimmed)) {
              prev = { speaker: null, text: trimmed };
              continue;
            }
            if (L.speaker || L.ch) {
              const cid = resolveSpeakerCharId(L, 'roam_talk', casting) || charId;
              const normText = normalizeVoiceText(L.text);
              const probeKey = `${cid}|${normText}`;
              if (!seenTalkProbe.has(probeKey)) {
                seenTalkProbe.add(probeKey);
                const voiceId = makeInteractiveVoiceId('roam_talk', cid, normText);
                pushRecord('batch_interactive', 'interactive_roam_talk', {
                  voiceId,
                  audioPath: `assets/voice/interactive/roam_talk/${voiceId}.mp3`,
                  tier: 'interactive',
                  kind: 'roam_talk',
                  charId: cid,
                  profileId: null,
                  speaker: L.speaker || CHARS[cid]?.short || cid,
                  emo: resolveLineEmo(L, cid),
                  zh_text: normText,
                  context_prev: prev ? formatPrevContext(prev) : `自由探索交谈（${CHARS[cid]?.short || cid}）`,
                });
              }
            }
            prev = { speaker: L.speaker || (L.ch && CHARS[L.ch]?.short) || null, text: trimmed };
          }
        }
      }
    }
  }
  ctx.Math.random = origRandom;

  // 重置干净默认状态后再挂载 Phase 2 模块
  ctx.S = ctx.baseState();

  // ---- Phase 2: 载入 BranchingDirector / RelicsAndEvents / CombatEngine / RaisingHub ----
  for (const rel of [
    'js/branching-director.js',
    'js/relics-and-events.js',
    'js/combat-engine.js',
    'js/raising-hub.js',
  ]) {
    loadScript(rel);
  }

  // ---- 4a. 立绘点触 SYLVIA_TAP_LINES (kind: tap) ----
  const tapTable = ctx.RaisingHub && ctx.RaisingHub.SYLVIA_TAP_LINES;
  if (!tapTable) throw new Error('RaisingHub.SYLVIA_TAP_LINES missing');
  for (const [stageKey, moods] of Object.entries(tapTable)) {
    for (const [moodKey, arr] of Object.entries(moods || {})) {
      const emo = moodKey === 'tired' ? 'sleepy' : moodKey === 'focused' ? 'serious' : 'smile';
      for (const rawText of arr || []) {
        const normText = normalizeVoiceText(rawText);
        const voiceId = makeInteractiveVoiceId('tap', 'sylvia', normText);
        pushRecord('batch_interactive', 'interactive_tap', {
          voiceId,
          audioPath: `assets/voice/interactive/tap/${voiceId}.mp3`,
          tier: 'interactive',
          kind: 'tap',
          stage: stageKey,
          mood: moodKey,
          charId: 'sylvia',
          profileId: null,
          speaker: '希尔维亚',
          emo,
          zh_text: normText,
          context_prev: `养成中心立绘点触（阶段:${stageKey} / 心境:${moodKey}）`,
        });
      }
    }
  }

  // ---- 4b. 送礼反应 GIFT_PREFS (kind: gift) ----
  const giftPrefs = ctx.RaisingHub && ctx.RaisingHub.GIFT_PREFS;
  if (!giftPrefs) throw new Error('RaisingHub.GIFT_PREFS missing');
  for (const [charId, pref] of Object.entries(giftPrefs)) {
    const sets = [
      { tag: 'normal', map: pref.reactions },
      { tag: 'frontline', map: pref.frontlineReactions },
    ];
    for (const { tag, map } of sets) {
      if (!map) continue;
      for (const [tierKey, rawText] of Object.entries(map)) {
        const normText = normalizeVoiceText(rawText);
        const emo = tierKey === 'loved' ? 'happy' : tierKey === 'liked' ? 'smile' : 'normal';
        const voiceId = makeInteractiveVoiceId('gift', charId, normText);
        pushRecord('batch_interactive', 'interactive_gift', {
          voiceId,
          audioPath: `assets/voice/interactive/gift/${voiceId}.mp3`,
          tier: 'interactive',
          kind: 'gift',
          reactionTier: `${tag}:${tierKey}`,
          charId,
          profileId: null,
          speaker: CHARS[charId]?.short || charId,
          emo,
          zh_text: normText,
          context_prev: `送礼反应（${CHARS[charId]?.short || charId} · ${tag === 'frontline' ? '北境前线' : '常规'} · ${tierKey}）`,
        });
      }
    }
  }

  // ---- 4e. branching-director.js 支线说话台词 (kind: branch) ----
  const branchSceneIds = Object.keys(SCENES).filter((id) => !VOL_BATCH_MAP[id]);

  // 劫持 playLines + 置空 AIChatPanel，无侵入捕抓 launchVignetteFreeTalk 的 nextSteps 台词
  const capturedFreeTalkSteps = [];
  const origPlayLines = ctx.playLines;
  const origAIChat = ctx.AIChatPanel;
  ctx.AIChatPanel = null;
  ctx.playLines = (steps) => {
    if (Array.isArray(steps)) capturedFreeTalkSteps.push(steps);
  };

  function walkBranchLines(sourceScene, lines, prefix = '', inheritedPrev = null) {
    if (!Array.isArray(lines)) return;
    let prev = inheritedPrev;

    lines.forEach((L, idx) => {
      if (!L || typeof L !== 'object') return;
      const lineIdx = prefix ? `${prefix}.${idx}` : `${idx}`;
      let rawText = '';
      if (typeof L.text === 'function') {
        ctx.S.causal = ctx.BranchingDirector.createDefaultCausal();
        rawText = String(L.text() || '');
      } else if (typeof L.text === 'string') {
        rawText = L.text;
      }
      const trimmed = rawText.trim();

      if (trimmed) {
        if (L.speaker || L.ch) {
          if (PURE_PAREN_ACTION_RE.test(trimmed)) {
            skippedParenthesized.push({
              scope: 'branch',
              sceneId: sourceScene,
              lineIdx,
              speaker: L.speaker || null,
              ch: L.ch || null,
              zh_text: trimmed,
            });
          } else {
            const charId = resolveSpeakerCharId(L, sourceScene, casting);
            if (!charId) {
              unmappedWarnings.push({
                reason: 'unresolvable_branch_speaker',
                sceneId: sourceScene,
                lineIdx,
                speaker: L.speaker || null,
                ch: L.ch || null,
                zh_text: trimmed,
              });
            } else {
              const normText = normalizeVoiceText(rawText);
              const voiceId = makeInteractiveVoiceId('branch', charId, normText);
              pushRecord('batch_interactive', 'interactive_branch', {
                voiceId,
                audioPath: `assets/voice/interactive/branch/${voiceId}.mp3`,
                tier: 'interactive',
                kind: 'branch',
                sceneId: sourceScene,
                lineIdx,
                charId,
                profileId: null,
                speaker: L.speaker || CHARS[charId]?.short || charId,
                emo: resolveLineEmo(L, charId),
                zh_text: normText,
                context_prev: formatPrevContext(prev),
              });
            }
          }
        }
        prev = { speaker: L.speaker || (L.ch && CHARS[L.ch]?.short) || null, text: trimmed };
      }

      if (Array.isArray(L.choices)) {
        L.choices.forEach((choice, ci) => {
          if (!choice) return;
          const choicePrev = { speaker: '选项', text: choice.text || '' };
          if (Array.isArray(choice.lines)) {
            walkBranchLines(sourceScene, choice.lines, `${lineIdx}.c${ci}`, choicePrev);
          }
          if (typeof choice.do === 'function' && /launchVignetteFreeTalk/.test(choice.do.toString())) {
            capturedFreeTalkSteps.length = 0;
            try {
              ctx.S.causal = ctx.BranchingDirector.createDefaultCausal();
              choice.do();
            } catch (e) {
              console.error('[extract] freeTalk capture failed', sourceScene, lineIdx, e);
            }
            capturedFreeTalkSteps.forEach((steps, si) => {
              walkBranchLines(sourceScene, steps, `${lineIdx}.c${ci}.ft${si}`, choicePrev);
            });
          }
        });
      }
    });
  }

  // 1) 17 个独立小场景与北境收束章
  for (const bsid of branchSceneIds) {
    walkBranchLines(bsid, SCENES[bsid].lines);
  }

  // 2) BranchingDirector 织入主线场景的蝴蝶效应说话行（对象引用不在 Phase 1 mainlineLineObjSet 中）
  for (const sid of orderedMainlineIds) {
    const splicedLines = (SCENES[sid].lines || []).filter(
      (L) => L && typeof L === 'object' && !mainlineLineObjSet.has(L)
    );
    if (splicedLines.length > 0) {
      walkBranchLines(sid, splicedLines, 'payoff');
    }
  }

  ctx.playLines = origPlayLines;
  ctx.AIChatPanel = origAIChat;

  // ---- 3. 战斗语音点位清单 (tier: "combat") ----
  const combatEntries = [];

  // 3a) 自动抽取 RelicsAndEvents.BOND_ASSISTS (5 位援护原话)
  const bondAssists = ctx.RelicsAndEvents && ctx.RelicsAndEvents.BOND_ASSISTS;
  if (!bondAssists) throw new Error('RelicsAndEvents.BOND_ASSISTS missing');
  for (const assistId of ['alice', 'noelle', 'aino', 'jilan', 'charlotte']) {
    const meta = bondAssists[assistId];
    if (!meta || !meta.quote) throw new Error(`Missing BOND_ASSISTS.${assistId}`);
    combatEntries.push({
      cueKey: `bond_assist_${assistId}`,
      charId: meta.charId || assistId,
      speaker: meta.name || CHARS[assistId]?.short || assistId,
      emo: 'serious',
      zh_text: normalizeVoiceText(meta.quote),
      context_prev: `战斗羁绊心念援护：${meta.name}·${meta.title}`,
    });
  }

  // 3b) 自动抽取 CombatEngine.STAGES 开场原话（4 位 Boss + 雷纳德乱葬岗协战）
  const stages = ctx.CombatEngine && ctx.CombatEngine.STAGES;
  if (!stages) throw new Error('CombatEngine.STAGES missing');
  const stageIntroDefs = [
    { stageId: 'beatrice_11',     cueKey: 'boss_beatrice_intro',   charId: 'beatrice', speaker: '贝阿特丽丝', emo: 'happy',   ctxLabel: '第一幕虚拟决斗开场：贝阿特丽丝' },
    { stageId: 'rowan_graveyard', cueKey: 'reno_graveyard_start',  charId: 'reno',     speaker: '雷纳德',     emo: 'serious', ctxLabel: '第二幕乱葬岗活捉战开场：雷纳德协战' },
    { stageId: 'alice_9',         cueKey: 'boss_alice_intro',      charId: 'alice',    speaker: '爱丽丝',     emo: 'normal',  ctxLabel: '第三幕虚拟决斗开场：爱丽丝' },
    { stageId: 'aino_sparring',   cueKey: 'boss_aino_intro',       charId: 'aino',     speaker: '艾诺',       emo: 'serious', ctxLabel: '第四幕冰上三击战开场：艾诺' },
    { stageId: 'wind_god_eye',    cueKey: 'boss_fengshen_intro',   charId: 'fengshen', speaker: '风神',       emo: 'smile',   ctxLabel: '第九幕风暴眼试剑开场：风神·岚' },
  ];
  for (const def of stageIntroDefs) {
    const intro = stages[def.stageId]?.waves?.[0]?.intro || '';
    const quote = extractBracketQuote(intro);
    if (!quote) throw new Error(`Failed to extract combat intro quote for ${def.stageId}`);
    combatEntries.push({
      cueKey: def.cueKey,
      charId: def.charId,
      speaker: def.speaker,
      emo: def.emo,
      zh_text: normalizeVoiceText(quote),
      context_prev: def.ctxLabel,
    });
  }

  // 3c) 运行期调用 triggerBossPhase2 实机捕获二阶段 Boss 宣言
  const phase2Defs = [
    {
      cueKey: 'boss_eastwing_phase2',
      charId: 'eastwing_commander',
      speaker: '东翼封锁官',
      emo: 'serious',
      ctxLabel: '第八幕东翼火廊突围战：东翼封锁官半血展开红莲铁幕',
      enemy: { id: 'eastwing_commander', aiType: 'eastwing_boss', name: '东翼封锁官·「红莲铁幕」', boss: true, phase: 1, mhp: 620, hp: 310, shield: 0, status: {} },
    },
    {
      cueKey: 'boss_fengshen_phase2',
      charId: 'fengshen',
      speaker: '风神',
      emo: 'serious',
      ctxLabel: '第九幕风暴眼试剑：风神·岚半血风暴眼全开',
      enemy: { id: 'wind_god_avatar', aiType: 'wind_god_boss', name: '风神·岚「风暴眼试剑」', boss: true, phase: 1, mhp: 940, hp: 470, shield: 0, status: {} },
    },
  ];
  for (const p2 of phase2Defs) {
    const dummyBattle = { headless: true, log: [], metrics: {}, enemies: [p2.enemy], player: { status: {} } };
    ctx.CombatEngine.triggerBossPhase2(dummyBattle, p2.enemy);
    const allQuotes = [...dummyBattle.log.join('\n').matchAll(/「([^」]+)」/g)].map((m) => m[1]);
    const quote = allQuotes[allQuotes.length - 1] || '';
    if (!quote || quote.length < 12) {
      throw new Error(`Failed to capture full Phase 2 speech quote for ${p2.cueKey}, got: ${quote}`);
    }
    combatEntries.push({
      cueKey: p2.cueKey,
      charId: p2.charId,
      speaker: p2.speaker,
      emo: p2.emo,
      zh_text: normalizeVoiceText(quote),
      context_prev: p2.ctxLabel,
    });
  }

  // 3d) 运行期无头 CombatEngine 实机触发 Boss 挡招 / 认输原话（零源码正则！）
  const bAino = ctx.CombatEngine.startStage('aino_sparring', { headless: true, usePreset: true });
  bAino.log.length = 0;
  ctx.CombatEngine.useSkill('hand_ice_crystal', 0, bAino);
  const ainoBlockLog = bAino.log.find((s) => String(s).includes('艾诺随手凝出一面无气泡薄冰挡下')) || '';
  const ainoBlockQuote = (ainoBlockLog.match(/：「([^」]+)」/) || [])[1] || '';
  if (!ainoBlockQuote) throw new Error('Failed to capture boss_aino_block via headless CombatEngine');
  combatEntries.push({
    cueKey: 'boss_aino_block',
    charId: 'aino',
    speaker: '艾诺',
    emo: 'normal',
    zh_text: normalizeVoiceText(ainoBlockQuote),
    context_prev: '第四幕冰上三击战：艾诺薄冰镜挡下经手冰晶',
  });

  bAino.log.length = 0;
  bAino.playerHits = 2;
  bAino.ap = 3;
  bAino.player.mp = bAino.player.mmp;
  if (!bAino.player.skills.includes('insight_aino_bead')) {
    bAino.player.skills.push('insight_aino_bead');
  }
  ctx.CombatEngine.useSkill('insight_aino_bead', 0, bAino);
  const ainoSurrLog = bAino.log.find((s) => String(s).includes('艾诺微怔')) || '';
  const ainoSurrQuote = (ainoSurrLog.match(/：「([^」]+)」/) || [])[1] || '';
  if (!ainoSurrQuote) throw new Error('Failed to capture boss_aino_surrender via headless CombatEngine');
  combatEntries.push({
    cueKey: 'boss_aino_surrender',
    charId: 'aino',
    speaker: '艾诺',
    emo: 'surprised',
    zh_text: normalizeVoiceText(ainoSurrQuote),
    context_prev: '第四幕冰上三击战：三击已满艾诺认输',
  });

  const bAlice = ctx.CombatEngine.startStage('alice_9', { headless: true, usePreset: true });
  bAlice.enemies[0].mp = 0;
  bAlice.enemies[0].intent = { selfFizzleIfLowMp: true, mpCost: 22, moveName: '狂岚' };
  bAlice.log.length = 0;
  ctx.CombatEngine.endTurn(bAlice);
  const aliceSurrLog = bAlice.log.find((s) => String(s).includes('爱丽丝晃了一下')) || '';
  const aliceSurrQuote = (aliceSurrLog.match(/：「([^」]+)」/) || [])[1] || '';
  if (!aliceSurrQuote) throw new Error('Failed to capture boss_alice_surrender via headless CombatEngine');
  combatEntries.push({
    cueKey: 'boss_alice_surrender',
    charId: 'alice',
    speaker: '爱丽丝',
    emo: 'sad',
    zh_text: normalizeVoiceText(aliceSurrQuote),
    context_prev: '第三幕虚拟决斗：爱丽丝魔力耗尽认输',
  });

  // 3e) 艾诺崖顶狙击（aino_spear）
  combatEntries.push(AINO_SPEAR_LINE);

  // 3f) 希尔维亚 15 条战斗系统短语音
  for (const sysLine of SYLVIA_SYSTEM_COMBAT_LINES) {
    combatEntries.push({
      cueKey: sysLine.cueKey,
      charId: 'sylvia',
      speaker: '希尔维亚',
      emo: sysLine.emo,
      zh_text: normalizeVoiceText(sysLine.zh_text),
      context_prev: sysLine.context_prev,
    });
  }

  // 3g) 希尔维亚 23 个战斗技能短咏唱（严格遍历 CombatEngine.SKILLS 校验 1:1 覆盖）
  const skills = ctx.CombatEngine.SKILLS;
  const skillIds = Object.keys(skills);
  if (skillIds.length !== 23) {
    throw new Error(`Expected 23 CombatEngine.SKILLS, got ${skillIds.length}`);
  }
  for (const skillId of skillIds) {
    const sk = skills[skillId];
    const chant = SYLVIA_SKILL_CHANTS[skillId];
    if (!chant) throw new Error(`Missing SYLVIA_SKILL_CHANTS entry for skillId: ${skillId}`);
    combatEntries.push({
      cueKey: `skill_${skillId}`,
      skillId,
      charId: 'sylvia',
      speaker: '希尔维亚',
      emo: chant.emo,
      zh_text: normalizeVoiceText(chant.zh_text),
      context_prev: `战斗技能短咏唱：${sk.name}（${sk.path}/${sk.elem}）`,
    });
  }

  // 校验所有 combatCueKeys 与 casting_fish_audio.json 完全一致
  const expectedCueKeys = new Set([
    ...casting.combatCueKeys.bondAssists,
    ...casting.combatCueKeys.bossQuotes,
    ...casting.combatCueKeys.allyCues,
    ...casting.combatCueKeys.sylviaSystem,
    ...casting.combatCueKeys.sylviaSkills,
  ]);
  const actualCueKeys = new Set(combatEntries.map((c) => c.cueKey));
  for (const k of expectedCueKeys) {
    if (!actualCueKeys.has(k)) throw new Error(`Expected combat cueKey not extracted: ${k}`);
  }
  for (const k of actualCueKeys) {
    if (!expectedCueKeys.has(k)) throw new Error(`Unexpected combat cueKey not in casting SSOT: ${k}`);
  }

  for (const c of combatEntries) {
    const voiceId = makeCombatVoiceId(c.cueKey);
    pushRecord('batch_combat_mono', 'combat', {
      voiceId,
      audioPath: `assets/voice/combat/${voiceId}.mp3`,
      tier: 'combat',
      cueKey: c.cueKey,
      ...(c.skillId ? { skillId: c.skillId } : {}),
      charId: c.charId,
      profileId: null,
      speaker: c.speaker,
      emo: c.emo,
      zh_text: c.zh_text,
      context_prev: c.context_prev,
    });
  }

  // =========================================================================
  // 六、写入 6 个平衡批次文件与 extraction_summary.json
  // =========================================================================
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const batchMeta = {
    batch_vol1a:       '第一卷前半主线对话（序章银与蓝 ～ 三姐妹的岁月）',
    batch_vol1b:       '第一卷后半主线对话（浪人叔叔 ～ 贝阿特丽丝离巢）',
    batch_vol2:        '第二卷魔法大学篇全部主线对话（离巢启程 ～ 转折点一）',
    batch_vol3_4:      '第三卷旅途篇 + 间章《白昼里的夜》全部主线对话',
    batch_combat_mono: '全部战斗语音（54条） + 全部显式 MONO 独白',
    batch_interactive: '全部立绘点触 + 送礼 + 自由探索问候/交谈 + 因果支线对话',
  };

  const batchCounts = {};
  const byProfile = {};
  const byChar = {};
  const byTier = {};

  for (const [name, items] of Object.entries(batches)) {
    batchCounts[name] = items.length;
    for (const it of items) {
      byProfile[it.profileId] = (byProfile[it.profileId] || 0) + 1;
      byChar[it.charId] = (byChar[it.charId] || 0) + 1;
      byTier[it.tier] = (byTier[it.tier] || 0) + 1;
    }
    const payload = {
      schemaVersion: '1.0.0',
      batchId: name,
      description: batchMeta[name],
      count: items.length,
      items,
    };
    fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }

  const summary = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    mainlineSceneCount: mainlineSceneIds.length,
    branchSceneCount: branchSceneIds.length,
    totalUniqueLines: dedupStats.uniqueTotal,
    totalRawLines: dedupStats.rawTotal,
    duplicatesCollapsed: dedupStats.duplicatesCollapsed,
    unmappedWarningCount: unmappedWarnings.length,
    unmappedWarnings,
    skippedParenthesizedCount: {
      total: skippedParenthesized.length,
      mainline: skippedParenthesized.filter((x) => x.scope === 'mainline').length,
      branch: skippedParenthesized.filter((x) => x.scope === 'branch').length,
    },
    skippedParenthesized,
    batchCounts,
    byTier,
    byCategory: dedupStats.byCategory,
    byProfile,
    byChar,
    combatCueCount: combatEntries.length,
    castingProfilesCount: casting.profiles.length,
    ssotVerification: {
      distinctPrimaryModels: primaryIds.size,
      allProfilesMapped: unmappedWarnings.length === 0,
      globalVoiceIdUnique: globalSeenVoiceIds.size === dedupStats.uniqueTotal,
    },
  };

  fs.writeFileSync(
    path.join(OUT_DIR, 'extraction_summary.json'),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8'
  );

  console.log('[extract_game_lines] Extraction complete!');
  console.log('  Mainline scenes:', summary.mainlineSceneCount, '| Branch scenes:', summary.branchSceneCount);
  console.log('  Batch counts:', JSON.stringify(batchCounts));
  console.log('  By tier:', JSON.stringify(byTier));
  console.log('  By category:', JSON.stringify(dedupStats.byCategory));
  console.log('  Total unique:', summary.totalUniqueLines, '| Raw:', summary.totalRawLines, '| Collapsed:', summary.duplicatesCollapsed);
  console.log('  Skipped parenthesized:', JSON.stringify(summary.skippedParenthesizedCount));
  console.log('  Unmapped warnings:', summary.unmappedWarningCount);

  if (unmappedWarnings.length > 0) {
    console.error('[extract_game_lines] UNMAPPED WARNINGS:', JSON.stringify(unmappedWarnings, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
