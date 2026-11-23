/* =========================================================
   转生千金～到了异世界就要悠闲地生活
   时间轴 + 体力 + 自由探索 + 勇者之赐 + 立绘差分
   ========================================================= */
'use strict';

const SAVE_KEY = 'ojousama_save_v1';
const CODEX_KEY = 'ojousama_codex_v1';
const MUTE_KEY = 'ojousama_muted';
const MUSIC_VOL_KEY = 'ojousama_music_vol';
const SFX_VOL_KEY = 'ojousama_sfx_vol';
const BGM_MUTE_KEY = 'ojousama_bgm_muted';
const TIERS = ['无','初级','中级','高级','圣级','王级','帝级','神级'];
const TODS = ['清晨','上午','下午','傍晚','夜晚'];
const TOD_ICON = ['🌅','☀️','🌤','🌇','🌙'];
const MONTH_DAYS = [0,31,28,31,30,31,30,31,31,30,31,30,31];
const SEASONS = ['春','夏','秋','冬'];
const SEASON_ICON = ['🌸','☀️','🍂','❄️'];
const SEASON_MONTH = {0:3, 1:6, 2:9, 3:12}; // 季度首月: 春3月 夏6月 秋9月 冬12月
const QUARTER_DAYS = [92, 92, 91, 90]; // 春(3-5月) 夏(6-8月) 秋(9-11月) 冬(12-2月) = 365
function seasonOf(month){
  if(month>=3 && month<=5) return 0;
  if(month>=6 && month<=8) return 1;
  if(month>=9 && month<=11) return 2;
  return 3;
}
function seasonName(s){ return SEASONS[s] || ''; }


// ========== AUDIO ==========
let ACTX = null, muted = (()=>{ try { return localStorage.getItem(MUTE_KEY) === '1'; } catch(e){ return false; } })();
let sfxVolume = (()=>{ try { const v = parseFloat(localStorage.getItem(SFX_VOL_KEY)); return isNaN(v) ? 0.65 : Math.max(0, Math.min(1, v)); } catch(e){ return 0.65; } })();
function sfxSetVolume(v){
  sfxVolume = Math.max(0, Math.min(1, Number(v)));
  if(isNaN(sfxVolume)) sfxVolume = 0.65;
  try { localStorage.setItem(SFX_VOL_KEY, String(sfxVolume)); } catch(e){}
  return sfxVolume;
}
function ensureAudio(){ if(!ACTX) try{ ACTX = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
function sfx(type){
  if(muted || sfxVolume <= 0.001) return; ensureAudio(); if(!ACTX) return;
  try { if(ACTX.state === 'suspended' && ACTX.resume) ACTX.resume(); } catch(e){}
  const t = ACTX.currentTime;
  const vol = Math.max(0.005, 0.085 * sfxVolume);
  const playTone = (freq, dur, wave, delay=0, gainMul=1, slideTo=null)=>{
    const o = ACTX.createOscillator(), g = ACTX.createGain();
    o.connect(g); g.connect(ACTX.destination);
    const st = t + delay;
    o.type = wave || 'sine';
    o.frequency.setValueAtTime(freq, st);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, st + dur);
    g.gain.setValueAtTime(Math.max(0.002, vol * gainMul), st);
    g.gain.exponentialRampToValueAtTime(0.0008, st + dur);
    o.start(st); o.stop(st + dur + 0.01);
  };
  if(type === 'parry'){
    playTone(1320, 0.11, 'triangle', 0, 1.0, 1760);
    playTone(1980, 0.16, 'sine', 0.03, 0.75, 2240);
    return;
  }
  if(type === 'shatter'){
    playTone(1580, 0.08, 'triangle', 0, 0.95, 920);
    playTone(2120, 0.12, 'sine', 0.04, 0.7, 1280);
    playTone(840, 0.18, 'sawtooth', 0.06, 0.45, 320);
    return;
  }
  if(type === 'phase2'){
    playTone(150, 0.42, 'sawtooth', 0, 0.9, 82);
    playTone(440, 0.36, 'triangle', 0.08, 0.7, 660);
    playTone(880, 0.4, 'sine', 0.16, 0.55, 1174);
    return;
  }
  if(type === 'grade_s' || type === 'egg'){
    playTone(659.25, 0.18, 'triangle', 0, 0.85);
    playTone(880, 0.2, 'triangle', 0.08, 0.85);
    playTone(1318.5, 0.34, 'sine', 0.16, 0.9);
    return;
  }
  if(type === 'ice_click'){
    playTone(1180, 0.06, 'sine', 0, 0.75, 1480);
    return;
  }
  const map = {
    click:[920,.05,'triangle',1120], ok:[587,.14,'sine',784], level:[659,.24,'triangle',987],
    bad:[190,.22,'sawtooth',125], magic:[880,.18,'sine',1320], open:[460,.11,'triangle',620],
    page:[660,.05,'triangle',520], heart:[740,.2,'sine',980], card_hover:[1040,.035,'sine',1180]
  };
  const [f,d,w,sl] = map[type] || map.click;
  playTone(f, d, w, 0, 0.85, sl);
}

// ========== BGM (背景音乐) ==========
// 情境 → 音乐文件（放在 Music/，相对路径 file:// 也能播）。缺文件则静默降级。
const BGM_BASE = 'Music/';
const BGM_FILES = {
  battle1:'Music/Battle & Tension 1.mp3',
  battle2:'Music/Battle & Tension 2.mp3',
  cheerful1:'Music/Cheerful 1.mp3',
  cheerful2:'Music/Cheerful 2.mp3',
  emotional1:'Music/Emotional 1.mp3',
  academy1:'Music/Magical Academy 1.mp3',
  academy2:'Music/Magical Academy 2.mp3',
  sad1:'Music/Melancholic & Sad 1.mp3',
  relax1:'Music/Peaceful & Relaxing 1.mp3',
  relax2:'Music/Peaceful & Relaxing 2.mp3',
  peaceful1:'Music/Peaceful 1.mp3',
  peaceful2:'Music/Peaceful 2.mp3',
  sacred1:'Music/Sacred 1.mp3',
  sacred2:'Music/Sacred 2.mp3',
  comedy_fast:'Music/Comical_fast-speed.mp3',
  comedy_medium:'Music/Comical_medium-speed.mp3',
  romantic:'Music/Romantic.mp3',
  upset:'Music/Upset.mp3',
};
let bgmEl = null;         // 当前 Audio 元素
let bgmKey = null;        // 当前播放的曲目 key
let bgmUnlocked = false;  // 用户手势后已解锁
let bgmCurType = null;    // 当前播放的情境类型
let sceneBgmType = null;  // 当前场景显式配置的 bgm 类型（贯穿整个场景，剧情中不被切走）
let bgmGroupIdx = {};     // 类型 -> 上次使用的曲目索引（轮换用）
let bgmLoc = null;        // 当前 bgm 所属地点（用于判断是否真的切换了地点）
let bgmVolume = (()=>{ try { const v=parseFloat(localStorage.getItem(MUSIC_VOL_KEY)); return isNaN(v)?0.5:Math.max(0,Math.min(1,v)); } catch(e){ return 0.5; } })();
let bgmMuted = (()=>{ try { return localStorage.getItem(BGM_MUTE_KEY)==='1'; } catch(e){ return false; } })();

// 同类型分组（策略 B：同情境在多首间轮换）
const BGM_GROUPS = {
  battle:   ['battle1','battle2'],
  cheerful: ['cheerful1','cheerful2'],
  academy:  ['academy1','academy2'],
  peaceful: ['peaceful1','peaceful2'],
  relax:    ['relax1','relax2'],
  sacred:   ['sacred1','sacred2'],
  sad:      ['sad1'],
  emotional:['emotional1'],
  comedy_fast:['comedy_fast'],
  comedy_medium:['comedy_medium'],
  romantic:['romantic'],
  upset:['upset'],
};

function bgmFileExists(key){
  if(!window || !window.fetch) return true; // 无法探测时乐观返回，Audio error 兜底
  return true; // 由 Audio onerror 兜底，避免每次 fetch
}
function bgmFadeTo(el, target, ms, done){
  if(!el || typeof el.volume !== 'number'){ if(done) done(); return; }
  const step = 50, cur = el.volume;
  const delta = (target - cur) / (ms/step);
  let n = 0;
  const iv = setInterval(()=>{
    n++;
    el.volume = Math.max(0, Math.min(1, el.volume + delta));
    if(n*step >= ms){ clearInterval(iv); el.volume = target; if(done) done(); }
  }, step);
}
function bgmStop(fade=true){
  const el = bgmEl;
  if(!el) return;
  bgmEl = null; bgmKey = null; bgmCurType = null; sceneBgmType = null;
  const kill = ()=>{ try{ el.pause(); }catch(e){} };
  if(fade){ try{ el.volume = Math.min(el.volume, bgmMuted?0:bgmVolume); }catch(e){} bgmFadeTo(el, 0, 600, kill); }
  else kill();
}
// 创建/获取持久的 DOM <audio> 元素（标准、可靠，优于 new Audio()）
function bgmAudio(){
  if(bgmEl) return bgmEl;
  let el;
  try { el = document.getElementById('bgm-audio') || document.createElement('audio'); }
  catch(e){ try{ el = new Audio(); }catch(e2){ return null; } }
  if(!el.loop) el.loop = true;
  if(!el.preload) el.preload = 'metadata';
  el.volume = bgmMuted ? 0 : bgmVolume;
  el.onerror = ()=>{ /* 加载失败：保留元素，只是本次不响，等待下次触发重试 */ };
  bgmEl = el;
  return el;
}
function encodeAudioPath(file){
  return String(file || '').split('/').map(seg => encodeURIComponent(seg)).join('/');
}
function bgmPlay(key, {fade=true}={}){
  if(!key) return;
  if(bgmKey === key && bgmEl && !bgmEl.paused) return; // 已播放同曲
  const file = BGM_FILES[key]; if(!file) return;
  const prev = bgmEl;
  bgmKey = key;
  // 淡出旧曲后换新
  const startNew = ()=>{
    if(bgmKey !== key) return; // 期间又被切换
    const el = bgmAudio(); if(!el) return;
    try { el.src = encodeAudioPath(file); el.loop = true; } catch(e){ return; } // 逐段 encodeURIComponent 编码空格与 &
    bgmEl = el;
    const p = el.play();
    if(p && p.catch) p.catch(()=>{ /* 自动播放被拒：等待 bgmUnlock 时重试 */ });
    // 淡入
    if(fade && !bgmMuted && !muted){ try{ el.volume = 0; }catch(e){} el.volume = 0; bgmFadeTo(el, bgmVolume, 650); }
  };
  if(prev && prev.src){
    const kill = ()=>{ try{ prev.pause(); }catch(e){} };
    if(fade){ try{ prev.volume = Math.min(prev.volume, bgmMuted?0:bgmVolume); }catch(e){} bgmFadeTo(prev, 0, 600, ()=>{ if(bgmKey===key) startNew(); else kill(); }); }
    else { kill(); startNew(); } // fade:false 也要启动新曲
  } else {
    startNew();
  }
}
// 用户手势后解锁音频（浏览器自动播放限制）——任何用户交互都会尝试恢复
function bgmUnlock(){
  bgmUnlocked = true;
  if(bgmEl){
    const p = bgmEl.play();
    if(p && p.catch) p.catch(()=>{});
  }
}
// 全局解锁：绑定 document 首次用户交互，确保任何进入路径都能发声
let _bgmGlobalBound = false;
function bgmBindGlobalUnlock(){
  if(_bgmGlobalBound) return; _bgmGlobalBound = true;
  const handler = ()=>{ bgmUnlock(); };
  document.addEventListener('pointerdown', handler, {once:false});
  document.addEventListener('keydown', handler);
}
// 背景类 → 情境类型的映射表（自由探索全覆盖：每个背景类都有确定类型）
const BG_CLASS_TYPE = {
  // 特殊/氛围类
  'bg-battle':'battle', 'bg-pick':'sacred', 'bg-duel':'battle', 'bg-title':'peaceful',
  'bg-void':'sad', 'bg-night':'relax', 'bg-snow':'relax', 'bg-forest':'sad',
  'bg-beach':'cheerful', 'bg-plain':'peaceful', 'bg-room':'peaceful', 'bg-hall':'peaceful',
  'bg-school':'academy', 'bg-garden':'cheerful', 'bg-study':'peaceful', 'bg-town':'cheerful',
  'bg-ending':'sacred',
  // 背景图类（地点/场景）
  'bg-img-nursery':'peaceful', 'bg-img-ownroom':'peaceful', 'bg-img-hallway':'peaceful', 'bg-img-parlor':'peaceful',
  'bg-img-garden':'cheerful', 'bg-img-study':'peaceful', 'bg-img-dining':'cheerful',
  'bg-img-kitchen':'cheerful', 'bg-img-training':'cheerful', 'bg-img-balcony':'relax',
  'bg-img-chapel':'sacred', 'bg-img-cellar':'peaceful', 'bg-img-town':'cheerful',
  'bg-img-beach':'cheerful', 'bg-img-dorm':'peaceful', 'bg-img-classroom':'academy',
  'bg-img-ice-classroom':'academy', 'bg-img-library':'academy', 'bg-img-cafeteria':'academy',
  'bg-img-clocktower':'academy', 'bg-img-flowerhouse':'peaceful', 'bg-img-memorial':'peaceful',
  'bg-img-auditorium':'sacred', 'bg-img-forest':'sad', 'bg-img-jikan':'peaceful',
  'bg-img-uni':'academy', 'bg-img-plain':'sacred', 'bg-img-village':'cheerful',
  'bg-img-castle':'sacred', 'bg-img-crosswalk-accident':'sad',
  'bg-img-classroom-locust':'peaceful',
  'bg-img-ice-canyon':'sad',
  'bg-img-chenglan-guild':'peaceful',
  'bg-img-north-forest':'sad',
  'bg-img-glow-sheep-hill':'relax',
  'bg-img-northwind-tavern':'relax',
  'bg-img-border-snowroad':'sad',
};
// 依据 bg 类 / phase 决定情境【类型】（而非固定单曲）。兜底 peaceful，保证全覆盖。
function bgmTypeForBg(cls, phase, loc){
  const c = cls || '';
  // 逐类查映射表，返回首个命中的类型
  const tokens = c.split(/\s+/);
  for(const t of tokens){
    const typ = BG_CLASS_TYPE[t];
    if(typ) return typ;
  }
  // 旅途/结局基调覆盖（即使 bg 类未单独列出）
  if(phase==='journey' || phase==='finale') return 'sacred';
  return 'peaceful';
}
// 按类型播放：同类型不打断；切换类型时在同组曲目间顺序轮换
function bgmPlayType(type, {force=false}={}){
  const group = BGM_GROUPS[type];
  if(!group || !group.length) return;
  if(!force && bgmCurType === type && bgmEl) return; // 同类型继续，不打断（不看 paused，避免同类型地点误切换曲）
  const idx = ((bgmGroupIdx[type] ?? -1) + 1) % group.length;
  bgmGroupIdx[type] = idx;
  bgmCurType = type;
  bgmPlay(group[idx]);
}
// 场景开始：记录场景 bgm 并强制播放，贯穿整个场景
function bgmSceneStart(type){
  sceneBgmType = type || null;
  bgmLoc = null; // 场景开始时重置地点跟踪，场景结束后自由探索会按当前地点切回音乐
  if(type) bgmPlayType(type, {force:true});
}
// 特殊状态结束后恢复到场景 bgm
function bgmRestoreScene(){
  if(sceneBgmType) bgmPlayType(sceneBgmType, {force:true});
}
// 自由探索：进入地点时按背景推断（仅 freeRoam 状态生效，剧情中不覆盖场景 bgm）
function bgmFreeRoam(cls, phase, loc){
  if(!S.freeRoam) return;          // 剧情中保持场景 bgm
  // 只有在「确实切换到了新地点」时才处理 bgm（避免同一地点内点修行/学习/休息等行动结束后重置/换曲）
  if(bgmLoc === loc) return;
  bgmLoc = loc;
  const type = bgmTypeForBg(cls, phase, loc);
  if(!type) return;
  // 不带 force：同类型地点之间（如育婴室→起居室，都是 peaceful）不换曲、继续播；
  // 切换到不同类型地点时才切曲（由 bgmPlayType 内部「同类型不打断」逻辑决定）
  bgmPlayType(type);
}
function bgmSyncFromBG(cls, phase, loc){
  const type = bgmTypeForBg(cls, phase, loc);
  if(!type) return;
  bgmPlayType(type);
}
function bgmApplyMute(){
  if(!bgmEl) return;
  if(bgmMuted || muted){ bgmFadeTo(bgmEl, 0, 300); }
  else { bgmEl.volume = 0; bgmFadeTo(bgmEl, bgmVolume, 500); }
}
function bgmSetVolume(v){
  bgmVolume = clamp(v, 0, 1);
  try { localStorage.setItem(MUSIC_VOL_KEY, String(v)); } catch(e){}
  if(bgmEl && !bgmMuted && !muted){ bgmEl.volume = 0; bgmFadeTo(bgmEl, bgmVolume, 300); }
}
function bgmSetMuted(m){
  bgmMuted = m;
  try { localStorage.setItem(BGM_MUTE_KEY, m?'1':'0'); } catch(e){}
  bgmApplyMute();
}
function bgmToggleMute(){
  bgmSetMuted(!bgmMuted);
  return bgmMuted;
}

// ========== PORTRAITS ==========
const PORTRAIT_FILES = {
  // ==== 希尔维亚（主角）三阶段 ====
  sylvia_child_normal:'assets/portraits/sylvia_child_normal.png',
  sylvia_child_sad:'assets/portraits/sylvia_child_sad.png',
  sylvia_child_serious:'assets/portraits/sylvia_child_serious.png',
  sylvia_child_shy:'assets/portraits/sylvia_child_shy.png',
  sylvia_child_surprised:'assets/portraits/sylvia_child_surprised.png',
  sylvia_child_teary:'assets/portraits/sylvia_child_teary.png',
  sylvia_child_wink:'assets/portraits/sylvia_child_wink.png',
  sylvia_child_happy:'assets/portraits/sylvia_child_happy.png',
  sylvia_child_smile:'assets/portraits/sylvia_child_smile.png',
  sylvia_young_normal:'assets/portraits/sylvia_young_normal.png',
  sylvia_young_sad:'assets/portraits/sylvia_young_sad.png',
  sylvia_young_serious:'assets/portraits/sylvia_young_serious.png',
  sylvia_young_shy:'assets/portraits/sylvia_young_shy.png',
  sylvia_young_surprised:'assets/portraits/sylvia_young_surprised.png',
  sylvia_young_teary:'assets/portraits/sylvia_young_teary.png',
  sylvia_young_wink:'assets/portraits/sylvia_young_wink.png',
  sylvia_young_happy:'assets/portraits/sylvia_young_happy.png',
  sylvia_young_smile:'assets/portraits/sylvia_young_smile.png',
  sylvia_teenage_normal:'assets/portraits/sylvia_teenage_normal.png',
  sylvia_teenage_sad:'assets/portraits/sylvia_teenage_sad.png',
  sylvia_teenage_serious:'assets/portraits/sylvia_teenage_serious.png',
  sylvia_teenage_sleepy:'assets/portraits/sylvia_teenage_sleepy.png',
  sylvia_teenage_surprised:'assets/portraits/sylvia_teenage_surprised.png',
  sylvia_teenage_teary:'assets/portraits/sylvia_teenage_teary.png',
  sylvia_teenage_wink:'assets/portraits/sylvia_teenage_wink.png',
  sylvia_teenage_happy:'assets/portraits/sylvia_teenage_happy.png',
  sylvia_teenage_smile:'assets/portraits/sylvia_teenage_smile.png',
  // 兜底：缺表情落到该档 normal
  sylvia_child:'assets/portraits/sylvia_child_normal.png',
  sylvia_normal:'assets/portraits/sylvia_young_normal.png',
  // ==== 贝阿特丽丝（姐姐=主角+2岁）三阶段 ====
  beatrice_child_normal:'assets/portraits/beatrice_child_normal.png',
  beatrice_young_normal:'assets/portraits/beatrice_young_normal.png',
  beatrice_young_sad:'assets/portraits/beatrice_young_sad.png',
  beatrice_young_serious:'assets/portraits/beatrice_young_serious.png',
  beatrice_young_surprised:'assets/portraits/beatrice_young_surprised.png',
  beatrice_young_teary:'assets/portraits/beatrice_young_teary.png',
  beatrice_young_wink:'assets/portraits/beatrice_young_wink.png',
  beatrice_teenage_normal:'assets/portraits/beatrice_teenage_normal.png',
  beatrice_teenage_sad:'assets/portraits/beatrice_teenage_sad.png',
  beatrice_teenage_teary:'assets/portraits/beatrice_teenage_teary.png',
  // 兜底：缺表情落到该档 normal
  beatrice_child:'assets/portraits/beatrice_child_normal.png',
  beatrice_normal:'assets/portraits/beatrice_young_normal.png',
  // ==== 爱丽丝（妹妹=主角-2岁）三阶段 ====
  alice_child_normal:'assets/portraits/alice_child_normal.png',
  alice_child_happy:'assets/portraits/alice_child_happy.png',
  alice_child_shy:'assets/portraits/alice_child_shy.png',
  alice_young_normal:'assets/portraits/alice_young_normal.png',
  alice_young_happy:'assets/portraits/alice_young_happy.png',
  alice_young_shy:'assets/portraits/alice_young_shy.png',
  alice_teenage_normal:'assets/portraits/alice_teenage_normal.png',
  alice_teenage_happy:'assets/portraits/alice_teenage_happy.png',
  alice_teenage_sad:'assets/portraits/alice_teenage_sad.png',
  alice_teenage_serious:'assets/portraits/alice_teenage_serious.png',
  alice_teenage_shy:'assets/portraits/alice_teenage_shy.png',
  alice_teenage_teary:'assets/portraits/alice_teenage_teary.png',
  alice_teenage_wink:'assets/portraits/alice_teenage_wink.png',
  // 兜底：缺表情落到该档 normal
  alice_child:'assets/portraits/alice_child_normal.png',
  alice_normal:'assets/portraits/alice_young_normal.png',
  sophia_normal:'assets/portraits/sophia_normal.png',
  claude_normal:'assets/portraits/claude_normal.png',
  noelle_normal:'assets/portraits/noelle_normal.png',
  emma_normal:'assets/portraits/emma_normal.png',
  charlotte_normal:'assets/portraits/charlotte_normal.png',
  aino_normal:'assets/portraits/aino_normal.png',
  helena_normal:'assets/portraits/helena_normal.png',
  ajun_normal:'assets/portraits/ajun_normal.png',
  reno_normal:'assets/portraits/reno_normal.png',
  yaoshen_normal:'assets/portraits/yaoshen_normal.png',
  jilan_normal:'assets/portraits/jilan_normal.png',
  ji_normal:'assets/portraits/ji_normal.png',
  hol_normal:'assets/portraits/hol_normal.png',
  fashen_normal:'assets/portraits/fashen_normal.png',
  anna_normal:'assets/portraits/anna_normal.png',
  teacher_normal:'assets/portraits/teacher_normal.png',
  lecturer_normal:'assets/portraits/magic_teacher.png',
  instructor_normal:'assets/portraits/sword_instructor.png',
  huke_normal:'assets/portraits/huke_normal.png',
  maid_normal:'assets/portraits/maid_normal.png',
  teacher_middle_normal:'assets/portraits/teacher_middle.png',
  merchant_bakery_normal:'assets/portraits/merchant_bakery.png',
  merchant_jewel_normal:'assets/portraits/merchant_jewel.png',
  jianshen_normal:'assets/portraits/jianshen_normal.png',
  wanshen_normal:'assets/portraits/wanshen_normal.jpg',
  fengshen_normal:'assets/portraits/fengshen_normal.png',
  shengnu_normal:'assets/portraits/shengnu_normal.png',
  moshen_normal:'assets/portraits/moshen_normal.png',
  // ==== 希尔维亚（伪装·眷寒渔：黑发墨绿眼深绿发带） ====
  sylvia_disguise_normal:'assets/portraits/sylvia_disguise_normal.png',
  sylvia_disguise_sad:'assets/portraits/sylvia_disguise_sad.png',
  sylvia_disguise_serious:'assets/portraits/sylvia_disguise_serious.png',
  sylvia_disguise_sleepy:'assets/portraits/sylvia_disguise_sleepy.png',
  sylvia_disguise_surprised:'assets/portraits/sylvia_disguise_surprised.png',
  sylvia_disguise_teary:'assets/portraits/sylvia_disguise_teary.png',
  sylvia_disguise_wink:'assets/portraits/sylvia_disguise_wink.png',
  sylvia_disguise_happy:'assets/portraits/sylvia_disguise_happy.png',
  sylvia_disguise_smile:'assets/portraits/sylvia_disguise_smile.png',
  // ==== 第三卷新增配角 ====
  masha_normal:'assets/portraits/masha_normal.png',
  kyle_normal:'assets/portraits/kyle_normal.png',
  mage_aurora_normal:'assets/portraits/mage_aurora_normal.png',
  axu_normal:'assets/portraits/axu_normal.png',
  musa_normal:'assets/portraits/musa_normal.png',
  jiqing_normal:'assets/portraits/jiqing_normal.png',
  servant_a_normal:'assets/portraits/servant_a_normal.png',
};
// 各角色相对主角的年龄差：姐姐=+2，妹妹=-2，其余角色=0（父母/师长等一律用成年档）
function charAgeDelta(charId){
  if(charId==='beatrice') return 2;
  if(charId==='alice') return -2;
  return 0;
}
// 返回该角色在剧情中的「自己年龄」（主角年龄 ± 差值）
function charAgeY(charId){
  return Math.max(0, S.ageY + (charAgeDelta(charId)||0));
}
// 立绘年龄档位：0=未命名(隐藏) 1=child(0-5) 2=youth(6-11) 3=normal(12+)
function portraitTierForAge(ageY){
  if(ageY <= 5) return 1;      // child
  if(ageY <= 11) return 2;     // youth
  return 3;                    // normal
}
function portraitAgeTier(){
  if(!flag('named')) return 0;
  return portraitTierForAge(S.ageY);
}
function portraitAgeTierFor(charId){
  // 主角用 portraitAgeTier()（含未命名隐藏）；其他角色按自己年龄
  if(charId==='sylvia') return portraitAgeTier();
  return portraitTierForAge(charAgeY(charId));
}
// 阶段名：用于拼立绘文件名 <id>_<阶段>_<表情>（如 alice_child_shy、sylvia_young_normal）
function portraitTierName(tier){
  return tier===1 ? 'child' : tier===2 ? 'young' : 'teenage';
}
// 即将回流的 2 位新角色 + 9 张表情差分协议（独立于磁盘已校验的 PORTRAIT_FILES，避免裂图且零配置无缝启用）
const PORTRAIT_DIFF_PROTOCOL = {
  lein_normal: 'assets/portraits/lein_normal.png',
  peilin_normal: 'assets/portraits/peilin_normal.png',
  aino_serious: 'assets/portraits/aino_serious.png',
  aino_smile: 'assets/portraits/aino_smile.png',
  aino_shy: 'assets/portraits/aino_shy.png',
  jilan_serious: 'assets/portraits/jilan_serious.png',
  jilan_shy: 'assets/portraits/jilan_shy.png',
  jilan_teary: 'assets/portraits/jilan_teary.png',
  charlotte_shy: 'assets/portraits/charlotte_shy.png',
  charlotte_smile: 'assets/portraits/charlotte_smile.png',
  noelle_smile: 'assets/portraits/noelle_smile.png',
};
const FAILED_PORTRAIT_URLS = new Set();

function resolvePortraitFallback(charId, emotion){
  if(charId==='sylvia'){
    if(!flag('named')) return null;
    const sc = currentScene && SCENES[currentScene];
    if(S.alias==='眷寒渔' && !(sc && sc.useOriginalSylvia)){
      return PORTRAIT_FILES.sylvia_disguise_normal;
    }
  }
  const tier = portraitAgeTierFor(charId);
  const tn = portraitTierName(tier);
  return PORTRAIT_FILES[`${charId}_${tn}_normal`]
    || PORTRAIT_FILES[`${charId}_normal`]
    || PORTRAIT_FILES[`${charId}_child`]
    || null;
}

function resolvePortrait(charId, emotion){
  const emo = emotion || 'normal';
  if(charId==='sylvia'){
    if(!flag('named')) return null; // hidden before naming
    const sc = currentScene && SCENES[currentScene];
    if(S.alias==='眷寒渔' && !(sc && sc.useOriginalSylvia)){
      return PORTRAIT_FILES[`sylvia_disguise_${emo}`] || PORTRAIT_FILES.sylvia_disguise_normal;
    }
  }
  const tier = portraitAgeTierFor(charId);
  const tn = portraitTierName(tier);
  // 优先：<id>_<阶段>_<表情>（如 alice_child_shy、sylvia_youth_normal）
  const tiered = PORTRAIT_FILES[`${charId}_${tn}_${emo}`];
  if(tiered && !FAILED_PORTRAIT_URLS.has(tiered)) return tiered;
  // 其次：<id>_<阶段>_normal
  const tieredN = PORTRAIT_FILES[`${charId}_${tn}_normal`];
  if(tieredN && !FAILED_PORTRAIT_URLS.has(tieredN)) return tieredN;
  // 再次：<id>_<表情>（先查磁盘已知，再查差分协议表）
  const plain = PORTRAIT_FILES[`${charId}_${emo}`];
  if(plain && !FAILED_PORTRAIT_URLS.has(plain)) return plain;
  const proto = PORTRAIT_DIFF_PROTOCOL[`${charId}_${emo}`];
  if(proto && !FAILED_PORTRAIT_URLS.has(proto)) return proto;
  // 最后：<id>_normal 或协议 normal 或 child 兜底
  const norm = PORTRAIT_FILES[`${charId}_normal`];
  if(norm && !FAILED_PORTRAIT_URLS.has(norm)) return norm;
  const protoNorm = PORTRAIT_DIFF_PROTOCOL[`${charId}_normal`];
  if(protoNorm && !FAILED_PORTRAIT_URLS.has(protoNorm)) return protoNorm;
  return PORTRAIT_FILES[`${charId}_child`] || null;
}

const CSS_CHARS = {
  sylvia:['希尔维亚','❄️'], beatrice:['贝阿特丽丝','🔥'], alice:['爱丽丝','💨'],
  sophia:['索菲亚','💙'], claude:['克劳德','⚔️'], noelle:['诺艾儿','💧'],
  emma:['艾玛','🍮'], charlotte:['夏洛特','👑'], aino:['艾诺','🧊'],
  helena:['海伦娜','✨'], ajun:['阿琼','🌶'], reno:['雷纳德','🗺'],
  yaoshen:['药神','💊'], fashen:['法神','🔥'], fengshen:['风神','🌪️'],
  ji:['霁馆主','🗡️'], jilan:['霁岚','💜'], lein:['莱恩','🍃'],
  peilin:['沛霖','🍵'], huke:['虎克','👦'], maid:['女仆','🧹'],
  teacher:['家庭教师','📖'], hol:['霍尔','📘'], anna:['安娜·贝尔','💧'],
  lecturer:['中年教师','📜'], instructor:['剑术教官','⚔️'],
  teacher_middle:['中年教师','📜'], merchant_bakery:['点心店老板','🍞'],
  merchant_jewel:['首饰店老板','💎'], jianshen:['剑神','⚔️'],
  wanshen:['万神','🏹'], shengnu:['圣女','✨'], moshen:['魔神','🌑'],
  masha:['玛莎','📋'], kyle:['凯尔','🗡️'], mage_aurora:['女法师','🔮'],
  axu:['阿蓿','🐑'], musa:['穆萨','🌿'], jiqing:['霁清','✉️'], servant_a:['侍从','🕯️'],
};

// ========== CHARACTERS META ==========
const CHARS = {
  sylvia:{name:'希尔维亚·维斯特利亚', short:'希尔维亚', css:'sylvia', role:'我'},
  beatrice:{name:'贝阿特丽丝·维斯特利亚', short:'贝蒂', css:'beatrice', role:'姐姐'},
  alice:{name:'爱丽丝·维斯特利亚', short:'爱丽丝', css:'alice', role:'妹妹'},
  sophia:{name:'索菲亚·维斯特利亚', short:'母亲', css:'sophia', role:'母亲'},
  claude:{name:'克劳德·维斯特利亚', short:'父亲', css:'claude', role:'父亲'},
  noelle:{name:'诺艾儿', short:'诺艾儿', css:'noelle', role:'同学'},
  emma:{name:'艾玛·克莱尔', short:'艾玛', css:'emma', role:'室友'},
  charlotte:{name:'夏洛特·贝尔蒙', short:'夏洛特', css:'charlotte', role:'对手'},
  aino:{name:'艾诺·塔尔维', short:'艾诺', css:'aino', role:'冰系同学'},
  helena:{name:'海伦娜·德尔菲', short:'海伦娜', css:'helena', role:'交换生'},
  ajun:{name:'阿琼·普拉塔', short:'阿琼', css:'ajun', role:'巴依留学生'},
  reno:{name:'雷纳德·维斯特利亚', short:'叔叔', css:'reno', role:'叔叔'},
  yaoshen:{name:'药神', short:'药神', css:'yaoshen', role:'列强'},
  fashen:{name:'法神', short:'法神', css:'fashen', role:'校长'},
  ji:{name:'霁馆主', short:'霁叔', css:'ji', role:'剑术老师'},
  jilan:{name:'霁岚', short:'霁岚', css:'jilan', role:'剑馆'},
  lein:{name:'莱恩', short:'莱恩', css:'lein', role:'旅伴'},
  peilin:{name:'沛霖', short:'沛霖', css:'peilin', role:'药商'},
  huke:{name:'虎克', short:'虎克', css:'huke', role:'诺艾儿之弟'},
  hol:{name:'霍尔', short:'霍尔', css:'hol', role:'冰系导师'},
  anna:{name:'安娜·贝尔', short:'安娜', css:'anna', role:'水系导师'},
  teacher:{name:'家庭教师', short:'家庭教师', css:'teacher', role:'启蒙老师'},
  lecturer:{name:'中年教师', short:'中年教师', css:'teacher', role:'教务'},
  instructor:{name:'剑术教官', short:'教官', css:'instructor', role:'教官'},
  maid:{name:'女仆', short:'女仆', css:'maid', role:'女仆'},
  teacher_middle:{name:'中年教师', short:'中年教师', css:'teacher_middle', role:'教务'},
  merchant_bakery:{name:'点心店老板', short:'点心店老板', css:'merchant_bakery', role:'商贩'},
  merchant_jewel:{name:'首饰店老板', short:'首饰店老板', css:'merchant_jewel', role:'商贩'},
  fengshen:{name:'风神', short:'风神', css:'fengshen', role:'七大列强'},
  jianshen:{name:'剑神', short:'剑神', css:'jianshen', role:'七大列强'},
  wanshen:{name:'万神', short:'万神', css:'wanshen', role:'七大列强'},
  shengnu:{name:'圣女', short:'圣女', css:'shengnu', role:'七大列强'},
  moshen:{name:'魔神', short:'魔神', css:'moshen', role:'七大列强'},
  masha:{name:'玛莎', short:'玛莎', css:'masha', role:'公会接待'},
  kyle:{name:'凯尔', short:'凯尔', css:'kyle', role:'极光队长'},
  mage_aurora:{name:'极光女法师', short:'女法师', css:'mage_aurora', role:'银级冒险者'},
  axu:{name:'阿蓿', short:'阿蓿', css:'axu', role:'牧羊女孩'},
  musa:{name:'穆萨', short:'穆萨', css:'musa', role:'随军老药师'},
  jiqing:{name:'霁清', short:'霁清', css:'jiqing', role:'送信少年'},
  servant_a:{name:'侍从', short:'侍从', css:'servant_a', role:'公爵府侍从'},
};

// 已习得魔法（非「勇者之赐」技能）的展示信息
const MAGIC_SKILLS = {
  water_ball:{id:'water_ball', name:'水球术 Lv.1', desc:'凝聚一颗水球进行攻击。'},
  ice_crystal:{id:'ice_crystal', name:'冰晶术 Lv.1', desc:'凝聚冰晶进行攻击或塑形。'},
};

// ========== LOCATIONS ==========
const LOCS = {
  // 公爵府
  nursery:{id:'nursery', name:'育婴室', icon:'🛏️', area:'公爵府', desc:'柔软的床铺与纱帐', bg:'bg-img-nursery bg-room', unlock:true, st:0, tags:['rest']},
  hallway:{id:'hallway', name:'长廊', icon:'🏛️', area:'公爵府', desc:'挂满祖先画像的走廊', bg:'bg-img-hallway bg-hall', unlock:true, st:1},
  parlor:{id:'parlor', name:'起居室', icon:'🛋️', area:'公爵府', desc:'阳光与地毯的起居室', bg:'bg-img-parlor bg-hall', unlock:true, st:1, tags:['talk']},
  garden:{id:'garden', name:'花园', icon:'🌹', area:'公爵府', desc:'修剪整齐的花圃', bg:'bg-img-garden bg-garden', unlock:true, st:1, tags:['train','egg']},
  study:{id:'study', name:'图书室', icon:'📚', area:'公爵府', desc:'三千册藏书的图书馆', bg:'bg-img-study bg-study', unlock:false, st:1, tags:['study','egg']},
  dining:{id:'dining', name:'餐厅', icon:'🍽️', area:'公爵府', desc:'长桌与银质餐具', bg:'bg-img-dining bg-hall', unlock:true, st:1, tags:['talk']},
  kitchen:{id:'kitchen', name:'厨房', icon:'🍳', area:'公爵府', desc:'香气与忙碌', bg:'bg-img-kitchen bg-room', unlock:false, st:1, tags:['egg']},
  training:{id:'training', name:'练武场', icon:'⚔️', area:'公爵府', desc:'木剑与沙地', bg:'bg-img-training bg-plain', unlock:false, st:1, tags:['train']},
  balcony:{id:'balcony', name:'露台', icon:'🌙', area:'公爵府', desc:'可眺望庭院的露台', bg:'bg-img-balcony bg-night', unlock:false, st:1, tags:['egg']},
  chapel:{id:'chapel', name:'小礼拜堂', icon:'⛪', area:'公爵府', desc:'安静的家庭礼拜堂', bg:'bg-img-chapel bg-hall', unlock:false, st:1, tags:['egg']},
  cellar:{id:'cellar', name:'酒窖', icon:'🍷', area:'公爵府', desc:'阴凉的地下酒窖', bg:'bg-img-cellar bg-void', unlock:false, st:2, tags:['egg']},
  secret:{id:'secret', name:'密道入口', icon:'🗝️', area:'公爵府', desc:'储藏室第三排砖', bg:'bg-void', unlock:false, st:1, tags:['egg']},
  // 外部
  town:{id:'town', name:'利维莫尔镇', icon:'🏘️', area:'领地', desc:'公爵领地的小镇', bg:'bg-img-town bg-town', unlock:false, st:3},
  market:{id:'market', name:'材料市场', icon:'🛒', area:'王都', desc:'王都中央材料市场（与公爵小镇不互通，从学院出发）', bg:'bg-img-town bg-town', unlock:false, st:4, tags:['egg']},
  beach:{id:'beach', name:'海滨别墅', icon:'🏖️', area:'领地', desc:'家族的海滨别墅', bg:'bg-img-beach bg-beach', unlock:false, st:2, tags:['talk']},
  ownroom:{id:'ownroom', name:'自己的房间', icon:'🛏️', area:'公爵府', desc:'属于自己的房间', bg:'bg-img-ownroom bg-room', unlock:false, st:0, tags:['rest']},
  // 学院
  dorm:{id:'dorm', name:'东区宿舍', icon:'🏠', area:'魔法大学', desc:'312号房间', bg:'bg-img-dorm bg-room', unlock:false, st:0, tags:['rest']},
  water_class:{id:'water_class', name:'水系教室', icon:'💧', area:'魔法大学', desc:'安娜·贝尔导师的教室', bg:'bg-img-classroom bg-school', unlock:false, st:1},
  ice_class:{id:'ice_class', name:'冰系教室', icon:'❄️', area:'魔法大学', desc:'只有八个座位的小教室', bg:'bg-img-ice-classroom bg-school', unlock:false, st:1, tags:['train','egg']},
  library:{id:'library', name:'学院图书馆', icon:'📖', area:'魔法大学', desc:'靠墙双人桌是据点', bg:'bg-img-library bg-study', unlock:false, st:1, tags:['study']},
  cafeteria:{id:'cafeteria', name:'食堂', icon:'🍮', area:'魔法大学', desc:'布丁圣地', bg:'bg-img-cafeteria bg-hall', unlock:false, st:1, tags:['talk']},
  clocktower:{id:'clocktower', name:'钟塔顶层', icon:'🗼', area:'魔法大学', desc:'风很大的安静角落', bg:'bg-img-clocktower bg-school', unlock:false, st:2, tags:['egg','study']},
  flowerhouse:{id:'flowerhouse', name:'校园花坊', icon:'🌺', area:'魔法大学', desc:'温室与北极铃兰', bg:'bg-img-flowerhouse bg-garden', unlock:false, st:1, tags:['egg']},
  training_field:{id:'training_field', name:'训练场', icon:'🗡️', area:'魔法大学', desc:'砂地与木桩', bg:'bg-img-training bg-plain', unlock:false, st:1, tags:['train']},
  memorial:{id:'memorial', name:'纪念林', icon:'🌳', area:'魔法大学', desc:'毕业生种下的树', bg:'bg-img-memorial bg-garden', unlock:false, st:2, tags:['egg']},
  auditorium:{id:'auditorium', name:'礼堂', icon:'🏛️', area:'魔法大学', desc:'大礼堂，开学典礼与欢迎仪式在此举行', bg:'bg-img-auditorium bg-hall', unlock:false, st:1, tags:['talk']},
  // 旅途
  road:{id:'road', name:'官道', icon:'🛤️', area:'旅途', desc:'通往远方的路', bg:'bg-img-plain bg-plain', unlock:false, st:2},
  jikan:{id:'jikan', name:'霁馆', icon:'🏯', area:'澄岚镇', desc:'冷清却温暖的剑馆', bg:'bg-img-jikan bg-room', unlock:false, st:0, tags:['rest','train']},
  chenglan_guild:{id:'chenglan_guild', name:'澄岚公会', icon:'🛡️', area:'澄岚镇', desc:'冒险者公会·澄岚支部', bg:'bg-img-chenglan-guild bg-town', unlock:false, st:1},
  northforest:{id:'northforest', name:'北林', icon:'🌲', area:'澄岚镇', desc:'魔物出没的林地', bg:'bg-img-north-forest bg-forest', unlock:false, st:3, tags:['train']},
  ice_canyon:{id:'ice_canyon', name:'冰封峡谷', icon:'🏔️', area:'赫兰', desc:'赫兰北境前线防线', bg:'bg-img-ice-canyon bg-snow', unlock:false, st:2, tags:['rest','train']},
};


// ========== ROOM EXITS (clickable hotspots) ==========
// pos: percent x,y on stage
const EXITS = {
  nursery:[
    // 婴儿默认只能待在育婴室；特殊出口由 renderHotspots 注入「闹着要出去」
    {to:'hallway', label:'门 · 长廊', icon:'🚪', x:88, y:44, st:1, needAge:1},
    {to:'parlor', label:'去起居室', icon:'🛋️', x:86, y:62, st:1, needAge:1},
  ],
  ownroom:[
    {to:'hallway', label:'长廊', icon:'🚪', x:88, y:44, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:86, y:62, st:0},
  ],
  hallway:[
    {to:'nursery', label:'育婴室', icon:'🛏️', x:12, y:34, st:0},
    {to:'ownroom', label:'自己的房间', icon:'🛏️', x:12, y:34, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:14, y:50, st:0},
    {to:'dining', label:'餐厅', icon:'🍽️', x:88, y:44, st:1},
    {to:'garden', label:'花园', icon:'🌹', x:50, y:18, st:1},
    {to:'study', label:'图书室', icon:'📚', x:26, y:20, st:1, needAge:1},
    {to:'kitchen', label:'厨房', icon:'🍳', x:86, y:60, st:1, needAge:2},
    {to:'balcony', label:'露台', icon:'🌙', x:86, y:24, st:1, needAge:2},
    {to:'training', label:'练武场', icon:'⚔️', x:12, y:64, st:1, needAge:1},
    {to:'chapel', label:'小礼拜堂', icon:'⛪', x:36, y:66, st:1, needAge:4},
    {to:'cellar', label:'酒窖', icon:'🍷', x:66, y:66, st:2, needAge:6},
  ],
  parlor:[
    {to:'hallway', label:'长廊', icon:'🚪', x:12, y:44, st:0},
    {to:'dining', label:'餐厅', icon:'🍽️', x:88, y:44, st:0},
    {to:'garden', label:'花园', icon:'🌹', x:50, y:18, st:1},
    {to:'nursery', label:'育婴室', icon:'🛏️', x:14, y:64, st:0},
    {to:'ownroom', label:'自己的房间', icon:'🛏️', x:14, y:64, st:0, needAge:8},
  ],
  garden:[
    {to:'hallway', label:'回府 · 长廊', icon:'🏛️', x:14, y:64, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:12, y:46, st:0},
    {to:'dining', label:'餐厅侧门', icon:'🍽️', x:86, y:64, st:0},
    {to:'training', label:'练武场', icon:'⚔️', x:88, y:46, st:1, needAge:1},
    {to:'town', label:'出府 · 小镇', icon:'🏘️', x:50, y:17, st:3, needAge:4},
  ],
  study:[
    {to:'hallway', label:'长廊', icon:'🚪', x:12, y:46, st:0},
    {to:'balcony', label:'露台', icon:'🌙', x:88, y:26, st:0, needAge:2},
  ],
  dining:[
    {to:'hallway', label:'长廊', icon:'🚪', x:12, y:46, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:14, y:64, st:0},
    {to:'kitchen', label:'厨房', icon:'🍳', x:88, y:48, st:0, needAge:2},
  ],
  kitchen:[
    {to:'dining', label:'餐厅', icon:'🍽️', x:12, y:46, st:0},
    {to:'hallway', label:'长廊', icon:'🚪', x:14, y:64, st:0},
    {to:'cellar', label:'酒窖', icon:'🍷', x:88, y:56, st:1, needAge:6},
  ],
  training:[
    {to:'garden', label:'花园', icon:'🌹', x:50, y:18, st:0},
    {to:'hallway', label:'长廊', icon:'🚪', x:12, y:58, st:0},
  ],
  balcony:[
    {to:'hallway', label:'长廊', icon:'🚪', x:12, y:54, st:0},
    {to:'study', label:'图书室', icon:'📚', x:88, y:46, st:0, needAge:1},
  ],
  chapel:[
    {to:'hallway', label:'长廊', icon:'🚪', x:14, y:62, st:0},
  ],
  cellar:[
    {to:'kitchen', label:'厨房', icon:'🍳', x:50, y:19, st:0},
    {to:'hallway', label:'长廊', icon:'🚪', x:12, y:48, st:1},
    {to:'secret', label:'松动的砖墙…', icon:'🗝️', x:86, y:58, st:1, needFlag:'can_secret'},
  ],
  secret:[
    {to:'cellar', label:'退回酒窖', icon:'🍷', x:50, y:22, st:0},
  ],
  town:[
    {to:'garden', label:'回公爵府', icon:'🌹', x:14, y:60, st:2},
    // 材料市场与公爵小镇不互通，需从王都单独进入
    {to:'beach', label:'海滨方向', icon:'🏖️', x:50, y:18, st:3, needAge:8},
  ],
  market:[
    // 材料市场不与公爵小镇互通，从学院/王都进入后只能回学院
    {to:'dorm', label:'回学院宿舍', icon:'🏠', x:14, y:54, st:1},
  ],
  beach:[
    {to:'town', label:'回小镇', icon:'🏘️', x:14, y:62, st:2},
  ],
  dorm:[
    {to:'cafeteria', label:'食堂', icon:'🍮', x:88, y:36, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:12, y:34, st:1},
    {to:'water_class', label:'水系教室', icon:'💧', x:88, y:54, st:1},
    {to:'training_field', label:'训练场', icon:'🗡️', x:12, y:54, st:1},
    {to:'auditorium', label:'礼堂', icon:'🏛️', x:50, y:18, st:1},
    {to:'market', label:'材料市场', icon:'🛒', x:86, y:66, st:2, needPhase:'academy'},
  ],
  water_class:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:12, y:46, st:1},
    {to:'ice_class', label:'冰系教室', icon:'❄️', x:88, y:36, st:1},
    {to:'cafeteria', label:'食堂', icon:'🍮', x:14, y:64, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:50, y:18, st:1},
    {to:'training_field', label:'训练场', icon:'🗡️', x:88, y:62, st:1},
  ],
  ice_class:[
    {to:'water_class', label:'水系教室', icon:'💧', x:12, y:46, st:0},
    {to:'flowerhouse', label:'花坊', icon:'🌺', x:88, y:42, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:14, y:64, st:1},
  ],
  library:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:12, y:54, st:1},
    {to:'clocktower', label:'钟塔', icon:'🗼', x:88, y:26, st:2},
    {to:'cafeteria', label:'食堂', icon:'🍮', x:86, y:62, st:1},
  ],
  cafeteria:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:12, y:46, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:50, y:18, st:1},
    {to:'training_field', label:'训练场', icon:'🗡️', x:88, y:54, st:1},
  ],
  clocktower:[
    {to:'library', label:'下楼 · 图书馆', icon:'📖', x:14, y:62, st:1},
  ],
  flowerhouse:[
    {to:'ice_class', label:'冰系教室', icon:'❄️', x:12, y:46, st:0},
    {to:'memorial', label:'纪念林', icon:'🌳', x:88, y:38, st:1},
  ],
  training_field:[
    {to:'cafeteria', label:'食堂', icon:'🍮', x:14, y:62, st:1},
    {to:'dorm', label:'宿舍', icon:'🏠', x:86, y:62, st:1},
    {to:'memorial', label:'纪念林', icon:'🌳', x:50, y:18, st:1},
  ],
  memorial:[
    {to:'training_field', label:'训练场', icon:'🗡️', x:14, y:62, st:1},
    {to:'flowerhouse', label:'花坊', icon:'🌺', x:12, y:38, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:88, y:52, st:1},
  ],
  auditorium:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:12, y:52, st:1},
    {to:'cafeteria', label:'食堂', icon:'🍮', x:88, y:52, st:1},
    {to:'water_class', label:'水系教室', icon:'💧', x:14, y:66, st:1},
  ],
  road:[
    {to:'jikan', label:'澄岚 · 霁馆', icon:'🏯', x:84, y:44, st:2},
    {to:'northforest', label:'北林', icon:'🌲', x:16, y:32, st:2},
    {to:'ice_canyon', label:'赫兰 · 冰封峡谷', icon:'🏔️', x:50, y:18, st:2, needFlag:'ch_distant_wind_2'},
  ],
  jikan:[
    {to:'chenglan_guild', label:'澄岚公会', icon:'🛡️', x:12, y:42, st:1},
    {to:'northforest', label:'北林', icon:'🌲', x:88, y:22, st:2},
    {to:'road', label:'官道', icon:'🛤️', x:13, y:62, st:1},
  ],
  chenglan_guild:[
    {to:'jikan', label:'回霁馆', icon:'🏯', x:14, y:62, st:1},
    {to:'northforest', label:'出镇 · 北林', icon:'🌲', x:88, y:26, st:2},
  ],
  northforest:[
    {to:'jikan', label:'回霁馆', icon:'🏯', x:14, y:62, st:2},
  ],
  ice_canyon:[
    {to:'road', label:'南返官道', icon:'🛤️', x:14, y:62, st:2},
  ],
};

// ========== SKILLS / PICKS ==========
const ALL_PICKS = {
  // 初级
  virtual_duel:{id:'virtual_duel', name:'虚拟决斗', tier:0, tag:'赋技能·特殊',
    desc:'可在梦中进行虚拟决斗。需对挑战对象了解度≥90%。胜利可获对方技能（赋级/简版取决于难度）。同一人不同时间段限一次。'},
  ice_sense:{id:'ice_sense', name:'寒息感知', tier:0, tag:'赋技能·被动',
    desc:'大幅提升对温度变化的感知。可感知30米内热源，对火系预判小幅提升。'},
  water_veil:{id:'water_veil', name:'水之帷幕', tier:0, tag:'赋魔法',
    desc:'凝聚水膜防御，可挡低级魔法与物理攻击。消耗中等。'},
  quiet_mind:{id:'quiet_mind', name:'静心', tier:0, tag:'赋技能·被动',
    desc:'冥想效率翻倍，每日首次休息额外回复体力。'},
  baby_talk:{id:'baby_talk', name:'天籁初声', tier:0, tag:'赋技能·特殊',
    desc:'（婴儿期限定）说出的话更容易被家人理解并提升好感。长大后转化为「真诚之言」。'},
  mana_sip:{id:'mana_sip', name:'魔力小啜', tier:0, tag:'赋技能·被动',
    desc:'普通饮食也可微量回复魔力值。'},
  silk_thread:{id:'silk_thread', name:'千缕银丝', tier:0, tag:'赋魔法',
    desc:'操纵极细冰丝进行束缚或侦察。受火克制。'},
  // 中级
  ice_palace:{id:'ice_palace', name:'冰晶宫殿', tier:1, tag:'赋技能·特殊',
    desc:'在意识中构建冰晶宫殿，可将亲眼所见场景永久冻结保存。可进入已保存记忆以旁观视角审视（时停，每天至多1小时）。每天至多冻结5次。'},
  multi_cast:{id:'multi_cast', name:'二重咏唱', tier:1, tag:'赋技能',
    desc:'可同时维持两个低阶魔法。'},
  frost_armor:{id:'frost_armor', name:'霜铠', tier:1, tag:'赋魔法',
    desc:'体表凝霜甲，提升物抗与法抗。'},
  deep_read:{id:'deep_read', name:'深读', tier:1, tag:'赋技能·被动',
    desc:'阅读与学习效率提升，了解度获取加快。'},
  mirror_ice:{id:'mirror_ice', name:'镜冰', tier:1, tag:'赋魔法',
    desc:'制造冰镜反射低阶光系/火系攻击。'},
  wind_step_s:{id:'wind_step_s', name:'残影步（简）', tier:1, tag:'赋剑技·简',
    desc:'短距离残影移动。冷却60秒。'},
  heal_touch:{id:'heal_touch', name:'温手', tier:1, tag:'赋技能',
    desc:'以体温与微量魔力加速浅表伤口愈合（需直接接触）。'},
  // 高级
  mana_cycle:{id:'mana_cycle', name:'魔战循环', tier:2, tag:'赋技能·被动',
    desc:'①攻击造成伤害后回复等量魔力值（不超过上限）。②魔法伤害额外增加：原伤害×(该魔法消耗÷总魔力值)。'},
  domain_frost:{id:'domain_frost', name:'霜域', tier:2, tag:'赋魔法',
    desc:'展开低温领域，范围内敌人移速下降，己方冰系强化。'},
  perfect_cast:{id:'perfect_cast', name:'无咏唱具现', tier:2, tag:'赋技能·被动',
    desc:'中级及以下冰/水魔法可无咏唱释放。'},
  fate_eye:{id:'fate_eye', name:'因果薄片', tier:2, tag:'赋技能·特殊',
    desc:'每天一次，可隐约感知某选择的短期后果倾向。'},
  sword_mana:{id:'sword_mana', name:'魔剑同化', tier:2, tag:'赋剑技',
    desc:'将魔力附着于剑身，物理攻击附带魔法伤害。'},
  memory_link:{id:'memory_link', name:'记忆连丝', tier:2, tag:'赋技能',
    desc:'与了解度≥70%的对象短时共享一段冻结记忆。'},
  zero_field:{id:'zero_field', name:'绝对零度逼近', tier:2, tag:'赋魔法·危险',
    desc:'极致降温。威力巨大但消耗极高，有自伤风险。'},
};

// 决斗奖励池
const DUEL_REWARDS = {
  beatrice_11:{id:'temp_sense', name:'温度感知', desc:'对周围温度变化感知大幅提升，可感知30米热源。'},
  alice_9:{id:'wind_afterimage', name:'风行残像', desc:'利用气流折射留下残影1.5秒，移速短暂+30%。消耗少量魔力，冷却60秒。'},
  noelle_14:{id:'mana_calc', name:'魔力精算', desc:'施法时自动优化魔力路径，减少约10%-15%魔力值消耗。'},
  aino_cur:{id:'root_ice', name:'生根之冰', desc:'冰墙/冰盾可从地面生根，结构大幅强化。'},
  claude_cur:{id:'noble_bearing', name:'公爵气度', desc:'交涉与威慑类检定小幅提升。'},
  sophia_cur:{id:'lullaby', name:'摇篮曲', desc:'休息时额外回复魔力值与好感。'},
};

// ========== TASKS & ACHIEVEMENTS ==========
const TASKS = [
  {id:'first_word', name:'第一声', desc:'说出人生中的第一个词', exp:50, auto:true},
  {id:'mana_sense', name:'魔力初感', desc:'首次成功感知并引导魔力', exp:100, auto:true},
  {id:'first_friend', name:'异邦之友', desc:'与一位来自其他国家的同龄人成为朋友', exp:150},
  {id:'ice_hits', name:'冰上之战', desc:'在实战中命中一位冰系魔法使三次', exp:300, prog:0, max:3},
  {id:'taste_foreign', name:'异国之味', desc:'品尝一道从未接触过的异国料理', exp:80},
  {id:'clock_tower', name:'校园探索·钟塔', desc:'前往学院钟塔顶层，记录景观', exp:200},
  {id:'market_walk', name:'王都漫步', desc:'前往王都中央材料市场', exp:120},
  {id:'lost_child', name:'迷途的旅人', desc:'帮助一位走失的孩子找到家人', exp:200},
  {id:'plant_tree', name:'并肩的树', desc:'与姐姐妹妹共同种下一棵树', exp:250},
  {id:'survive_night', name:'活下去', desc:'在逃亡的第一夜存活', exp:500},
];

const ACH = [
  {id:'born_again', name:'第二次出生', desc:'以婴儿之身睁开双眼', reward:'经验×10'},
  {id:'three_sisters', name:'三姐妹', desc:'与姐姐、妹妹组成三姐妹', reward:'了解度获取+5%'},
  {id:'lazy_genius', name:'怠惰的天才', desc:'在发呆中领悟魔力', reward:'静心相关'},
  {id:'potion_god', name:'药神的小瓶', desc:'收到药神赠礼', reward:'图鉴解锁·药神'},
  {id:'virtual_first', name:'梦中初胜', desc:'赢得第一场虚拟决斗', reward:'经验×50'},
  {id:'ice_palace_on', name:'冰中宫殿', desc:'构建冰晶宫殿', reward:'记忆格+3'},
  {id:'micro_service', name:'微服翻车', desc:'三姐妹微服出行并震惊全城', reward:'金币？？？'},
  {id:'shell_gift', name:'月虹螺之约', desc:'完成海滨的贝壳饰品', reward:'永久纪念'},
  {id:'egg_garden', name:'花园密语', desc:'在花园发现隐藏彩蛋', reward:'小礼物'},
  {id:'egg_cellar', name:'酒窖低语', desc:'在酒窖发现初代公爵的留言', reward:'剧情线索'},
  {id:'egg_clock', name:'钟塔野猫', desc:'在钟塔投喂野猫', reward:'诺艾儿好感'},
  {id:'black_hair', name:'墨色之名', desc:'以眷寒渔之名踏上旅途', reward:'身份切换'},
  {id:'sword_begin', name:'竹剑初握', desc:'在霁馆开始学剑', reward:'攻击成长开启'},
  {id:'birthday_15', name:'十五岁的饼', desc:'在异乡过生日', reward:'深绿色发带'},
  {id:'glow_sheep_night', name:'星河牧羊', desc:'在春夜原野与萤尾羊群一同奔跑', reward:'经验×1'},
  {id:'frost_reunion', name:'雪后松林', desc:'在冰封峡谷与故人并肩御敌', reward:'雪花手帕'},
  {id:'mana_calc', name:'分毫不差', desc:'在虚拟决斗中战胜十四岁的诺艾儿', reward:'被动·魔力精算'},
  {id:'hulan_vanguard', name:'风雪猎场', desc:'在赫兰冰封峡谷协防战中守住防线并击溃领主', reward:'北境战功'},
];

// ========== STATE ==========
function baseState(){
  return {
    name:'希尔维亚·维斯特利亚', alias:null,
    ageY:0, ageD:0, year:0, month:3, day:1, tod:1, season:0, // 春=0 出生第0年3月1日
    hp:8, mhp:8, mp:12, mmp:12, st:5, mst:5,
    atk:1, mag:4, pdef:0, mdef:0,
    lv:1, exp:0, next:100,
    tier:0, // 0无 1初级...
    gold:0,
    affinity:['ice','water'],
    skills:[], // learned pick ids + magic
    magic:{}, // id -> lv
    inv:[], // {id,name,icon,desc}
    flags:{},
    love:{}, // charId -> 0-5
    know:{}, // charId -> 0-100
    tasks:{}, // id -> {done,prog}
    ach:{},
    loc:'nursery',
    phase:'prologue', // prologue | childhood | youth | academy | journey | finale
    dayCount:0,
    deaths:0,
    memories:[], // ice palace
    duelWins:[],
    picksDone:[], // tier indexes already used
    eggs:[],
    log:[],
    freeRoam:false,
    storyGateVersion: 3,
    storyPending: [], // 已到期但尚未完整播放的剧情；刷新/读档后自动恢复
    seasonFlavorPending: false, // 本次季度风物等待剧情结束后显示
    lastSafe:'nursery',
    // 养成四维（火山的女儿式）0-100
    stats:{ body:5, mind:15, mana:10, charm:8 },
    courses:{}, // id -> {lv, exp}
    skillsLearned:[],
    // season 0春1夏2秋3冬
    restThisSeason: 0,
    sickUntil: 0,
    seasonChars: {}, // season -> {char: loc}
    equippedRelics: [],
    relicsUnlocked: {},
    selectedBondAssist: null,
    seasonalBoard: null,
    encounterHistory: {},
    causal: (typeof BranchingDirector !== 'undefined' && BranchingDirector.createDefaultCausal)
      ? BranchingDirector.createDefaultCausal()
      : {
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
        },
  };
}
var S = baseState();
var B = null; // battle
var sceneQueue = [];
var storyChain = null; // 剧情链：runSceneQueue 顺序播放的剩余场景
var typing = false, typeTimer = null, fullText = '', textIdx = 0;
var currentScene = null;
var pendingPicks = null;
let codex = (()=>{ try { return JSON.parse(localStorage.getItem(CODEX_KEY) || '{"endings":[],"chars":[],"eggs":0}'); } catch(e){ return {endings:[],chars:[],eggs:0}; } })();

// ========== UTILS ==========
var $ = id => document.getElementById(id);
function show(el,on=true){ if(typeof el==='string') el=$(el); if(el) el.classList.toggle('hidden', !on); }

/* 底部 UI 高度由实际布局决定；只记录可见高度，剧情模式沿用固定 131px 对话框。 */
function syncActionBarHeight(){
  const bar=$('action-bar'), screen=$('game-screen');
  if(!bar || !screen) return 0;
  const h=Math.round(bar.getBoundingClientRect().height);
  if(h>0) screen.style.setProperty('--abh', h+'px');
  return h;
}
function bindActionBarHeight(){
  const bar=$('action-bar');
  if(!bar) return;
  syncActionBarHeight();
  if(window.ResizeObserver){
    const observer=new window.ResizeObserver(syncActionBarHeight);
    observer.observe(bar);
    window.__actionBarHeightObserver=observer;
  }
  window.addEventListener('resize', syncActionBarHeight);
}
bindActionBarHeight();

function toast(msg, ms=2200){ const t=$('toast'); t.textContent=msg; show(t,1); clearTimeout(t._t); t._t=setTimeout(()=>show(t,0),ms); }
function sysPopup(title, body){
  const p=$('sys-popup');
  const prismCrest = `<svg class="sp-crest" viewBox="0 0 28 28" width="22" height="22" fill="none" aria-hidden="true"><polygon points="14,2 25,14 14,26 3,14" stroke="currentColor" stroke-width="1.6" fill="rgba(255,255,255,0.14)"/><polygon points="14,7.5 20.5,14 14,20.5 7.5,14" stroke="#BAE6FD" stroke-width="1.15"/><circle cx="14" cy="14" r="2.2" fill="#FFFFFF"/></svg>`;
  p.innerHTML=`<div class="sp-head"><div class="sp-head-row">${prismCrest}<h3>${title}</h3></div><span class="sp-code" aria-hidden="true">AETHER PRISM OS</span></div><div class="sp-rule"></div><div class="sp-body">${body}</div><button class="sp-close">确认</button>`;
  show(p,1); sfx('open');
  // 点弹窗任意处或「确认」都关闭
  p.onclick=()=>{ show(p,0); };
}
function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function hasSkill(id){ return S.skills.includes(id); }
function addSkill(id){ if(!S.skills.includes(id)) S.skills.push(id); }
function flag(k,v){ if(arguments.length<2) return S.flags[k]; S.flags[k]=v; return v; }
function love(id, d){ S.love[id]=(S.love[id]||0)+d; S.love[id]=clamp(S.love[id],0,5); if(d>0){ sfx('heart'); toast(`${CHARS[id]?.short||id} 好感 ${d>0?'+':''}${d}`); } }
function know(id, d){ S.know[id]=clamp((S.know[id]||0)+d,0,100); }
function doneTask(id){
  const t = TASKS.find(x=>x.id===id); if(!t) return;
  if(S.tasks[id]?.done) return;
  S.tasks[id]={done:true, prog:t.max||1};
  addExp(t.exp||0);
  sysPopup('📜 任务完成', `✅「${t.name}」<br>奖励：经验值 ×${t.exp}`);
  sfx('ok');
}
function ach(id){
  if(S.ach[id]) return;
  const a = ACH.find(x=>x.id===id); if(!a) return;
  S.ach[id]=true; codex.eggs = Object.keys(S.ach).length;
  saveCodex(); sfx('egg');
  toast(`🏆 成就：${a.name}（${a.reward}）`);
}
function addExp(n){
  if(n<=0) return; S.exp += n; S.exp = Math.floor(S.exp); // 经验取整，避免显示小数
  let up=false;
  while(S.exp >= S.next){ S.exp -= S.next; S.lv++; S.next = Math.floor(S.next*1.15+20);
    // 只涨上限与基础属性，不回满生命/魔力/体力
    S.mhp+=3; S.mmp+=5; S.atk+=1; S.mag+=2; S.pdef+=1; S.mdef+=1;
    S.hp=Math.min(S.hp, S.mhp); S.mp=Math.min(S.mp, S.mmp);
    // 体力与等级脱钩，不因升级改变
    up=true;
  }
  if(up){ sfx('level'); toast(`⭐ 升级！Lv.${S.lv}`); checkTierUp(); }
  updateHUD();
}
function checkTierUp(){
  // 勇者之赐完全由剧情驱动，不在此触发
}
const STACKABLE_ITEM_IDS = { cookie: 1 };
function addItem(it){
  if(!it) return;
  if(it.id && !STACKABLE_ITEM_IDS[it.id]){
    const idx = S.inv.findIndex(x => x && x.id === it.id);
    if(idx >= 0){
      S.inv[idx] = Object.assign({}, S.inv[idx], it);
      if(typeof RelicsAndEvents!=='undefined'&&RelicsAndEvents.onItemAdded) RelicsAndEvents.onItemAdded(it, S);
      toast(`📦 更新：${it.name}`); sfx('ok');
      return;
    }
  }
  S.inv.push(it);
  if(typeof RelicsAndEvents!=='undefined'&&RelicsAndEvents.onItemAdded) RelicsAndEvents.onItemAdded(it, S);
  toast(`📦 获得：${it.name}`); sfx('ok');
}
// 使用消耗品：热饼干恢复1点体力
function useItem(id){
  const idx = S.inv.findIndex(it=>it.id===id);
  if(idx<0) return;
  const it = S.inv[idx];
  if(it.id==='cookie'){
    S.st = clamp(S.st + 1, 0, S.mst);
    S.inv.splice(idx,1);
    sfx('ok');
    updateHUD();
    openPanel('inv');
    toast(`🍪 吃掉了热饼干，体力 +1（当前 ${S.st}/${S.mst}）`);
  }
}
function dateStr(){
  const s = (S.season!=null) ? S.season : seasonOf(S.month||3);
  return `${S.year}年 · ${seasonName(s)}`;
}
function dateStrLong(){
  const s = (S.season!=null) ? S.season : seasonOf(S.month||3);
  return `${S.year}年${SEASONS[s]} · ${S.month}月${S.day}日 ${TOD_ICON[S.tod]||''}${TODS[S.tod]||''}`;
}
function ageStr(){
  if(S.ageY<=0) return `${S.ageD}天`;
  return `${S.ageY}岁`;
}
function tierName(){ return TIERS[S.tier]||'无'; }
// 阶段显示名（内部变量保持英文，仅显示用中文）
const PHASE_NAMES = { prologue:'序章', childhood:'童年', youth:'少女期', academy:'学院篇', journey:'旅途篇', finale:'终章' };
function phaseName(){ return PHASE_NAMES[S.phase] || S.phase || ''; }
// 日历比较：当前日期是否 >= 指定年月
function dateAtLeast(y, m){ return S.year > y || (S.year === y && S.month >= m); }

// ========== TIME & STAMINA ==========
function advanceTod(n=1){
  for(let i=0;i<n;i++){
    S.tod++;
    if(S.tod>=5){ S.tod=0; advanceDay(1); }
  }
  // 不被动回复体力（体力只能通过休息/换日恢复）
  updateHUD(); save();
}
function advanceDay(n=1){
  for(let i=0;i<n;i++){
    S.day++; S.dayCount++; S.ageD++;
    const md = MONTH_DAYS[S.month]||30;
    if(S.day>md){ S.day=1; S.month++; if(S.month>12){ S.month=1; S.year++; } }
    // birthday: born month 3 day 1
    if(S.month===3 && S.day===1 && S.dayCount>1){ S.ageY++; S.ageD=0; }
    // also roll age by total days as fallback
    const byDays = Math.floor(S.dayCount/365);
    if(byDays>S.ageY) { S.ageY=byDays; S.ageD=S.dayCount%365; }
    // daily reset
    flag('talked_today', {});
    checkAgeEvents();
  }
  // 不回复体力（体力只在休息和换季时回复）
  S.hp = clamp(S.hp+Math.floor(S.mhp*0.3),0,S.mhp);
  S.mp = clamp(S.mp+Math.floor(S.mmp*0.3),0,S.mmp);
}

function advanceSeason(n=1){
  for(let i=0;i<n;i++){
    const days = QUARTER_DAYS[S.season != null ? S.season : seasonOf(S.month)]; // 当前季度的天数
    S.season = ((S.season!=null?S.season:seasonOf(S.month)) + 1) % 4;
    if(S.season === 0) S.year++;
    // 推进到下一季度节点
    S.month = SEASON_MONTH[S.season];
    S.day = 1;
    S.tod = 1;
    S.dayCount += days;
    S.ageD += days;
    while(S.ageD >= 365){ S.ageD -= 365; S.ageY++; }
    flag('talked_today', {});
    S.restThisSeason = 0;
    // restore
    S.st = S.mst; // 换季体力回满
    S.hp = clamp(S.hp + Math.floor(S.mhp*0.5), 0, S.mhp);
    S.mp = clamp(S.mp + Math.floor(S.mmp*0.5), 0, S.mmp);
    // unlocks by age
    if(S.ageY>=1){ LOCS.study.unlock=true; LOCS.training.unlock=true; }
    if(S.ageY>=2){ LOCS.kitchen.unlock=true; LOCS.balcony.unlock=true; }
    if(S.ageY>=4){ LOCS.chapel.unlock=true; LOCS.town.unlock=true; }
    if(S.ageY>=6){ LOCS.cellar.unlock=true; }
    if(S.ageY>=8){ LOCS.beach.unlock=true; LOCS.ownroom.unlock=true; }
    if(S.ageY>=8 && S.loc==='nursery'){ S.loc='ownroom'; }
  }
  // 14岁9月起：若此前因特殊操作仍停在海滨别墅等学院外地点，强制跳回学院寝室
  if(S.phase==='academy' && dateAtLeast(14,9) && !phaseAreaAllowed(LOCS[S.loc]?.area)){
    S.loc='dorm'; updateLocBar(); setBG('bg-img-dorm bg-room'); renderHotspots();
  }
  syncStatsToAge();
  if(typeof RelicsAndEvents!=='undefined'&&RelicsAndEvents.onSeasonAdvanced) RelicsAndEvents.onSeasonAdvanced(S);
  updateHUD();
  save();
  renderHotspots();
}

function spendST(n){
  if(S.st < n){ toast('体力不足，先休息吧'); sfx('bad'); return false; }
  S.st -= n; updateHUD();
  if(S.st<=0){ toast('体力耗尽……强制休息'); forceRest(); }
  return true;
}
function forceRest(){
  S.freeRoam=false;
  playLines([
    {text:'眼前一黑……体力已经到极限了。'},
    {text:'不知被谁扶回了房间。'},
    {do:()=>{ S.st=Math.floor(S.mst*0.5); S.loc=S.lastSafe||'nursery'; updateLocBar(); },
     text:'休息之后，体力恢复了一些。', freeRoam:true}
  ]);
}
function checkAgeEvents(){
  // handled by phase scenes mostly
}
function syncStatsToAge(){
  // 体力上限：初始5，每2岁+1，最多额外+10（20岁时封顶15）
  S.mst = Math.max(S.mst, 5 + Math.min(10, Math.floor(S.ageY / 2)));
  S.st = Math.min(S.st, S.mst);
  // 其他属性随年龄成长
  if(S.ageY>=1 && S.ageY<3){ S.mhp=Math.max(S.mhp,18); S.mmp=Math.max(S.mmp,20); }
  if(S.ageY>=3){ S.mhp=Math.max(S.mhp,35); S.mmp=Math.max(S.mmp,52); S.mag=Math.max(S.mag,12); }
  if(S.ageY>=5){ S.mhp=Math.max(S.mhp,55); S.mmp=Math.max(S.mmp,80); S.mag=Math.max(S.mag,22); S.lv=Math.max(S.lv,8); }
  if(S.ageY>=8){ S.mhp=Math.max(S.mhp,100); S.mmp=Math.max(S.mmp,150); S.mag=Math.max(S.mag,45); S.atk=Math.max(S.atk,12); S.lv=Math.max(S.lv,15); if(S.phase==='prologue'||S.phase==='childhood') S.phase='youth'; }
  if(S.ageY>=10){ S.mhp=Math.max(S.mhp,164); S.mmp=Math.max(S.mmp,285); S.mag=Math.max(S.mag,67); S.lv=Math.max(S.lv,22); }
  if(S.ageY>=12){ S.lv=Math.max(S.lv,28); }
  if(S.ageY>=13){ S.lv=Math.max(S.lv,31); S.mmp=Math.max(S.mmp,324); S.mag=Math.max(S.mag,112); }
  // 不回满任何条
  S.hp=Math.min(S.hp, S.mhp); S.mp=Math.min(S.mp, S.mmp); S.st=Math.min(S.st, S.mst);
  S.next = Math.max(S.next, 100+S.lv*20);
  if(S.ageY>=1){ LOCS.study.unlock=true; LOCS.training.unlock=true; }
  if(S.ageY>=2){ LOCS.kitchen.unlock=true; LOCS.balcony.unlock=true; }
  if(S.ageY>=4){ LOCS.chapel.unlock=true; LOCS.town.unlock=true; }
  if(S.ageY>=6){ LOCS.cellar.unlock=true; }
  if(S.ageY>=8){ LOCS.beach.unlock=true; LOCS.ownroom.unlock=true; }
  if(S.ageY>=8 && S.loc==='nursery'){ S.loc='ownroom'; }
  updateHUD();
}
function skipDays(n){ toast("已关闭快进"); return; }
function skipToAge(y){ toast("已关闭快进，请按季度推进"); return; }

// ========== SAVE ==========
const STORY_GATE_VERSION = 3;
const STORY_GATE_FLAGS = [
  'ch_first_word','ch_alice_born','ch_child_days','ch_age4','ch_yaoshen','ch_sisters_grow',
  'ch_reno_arrive','ch_alice_affinity','ch_beatrice_day','ch_micro','ch_alice_wind','ch_beatrice_leaves',
  'ch_academy','ch_opening_ceremony','met_noelle','met_aino','met_charlotte',
  'ch_helena','ch_aino_sparring','met_ajun','ch_ice_melt_1','ch_seven_mountains',
  'ch_ice_melt_2','ch_beach','ch_tree','ch_star','did_turnpoint','arrived_jikan','ch_black_name',
  'ch_north_forest','ch_glow_sheep','ch_distant_wind_1','ch_words_to_wind','ch_eye_of_storm','ch_leaky_cup','ch_distant_wind_2'
];
const STORY_GATE_ACADEMY_FLAGS = [
  'ch_helena','ch_aino_sparring','met_ajun','ch_ice_melt_1','ch_seven_mountains',
  'ch_ice_melt_2','ch_beach','ch_tree','ch_star','did_turnpoint','arrived_jikan','ch_black_name',
  'ch_north_forest','ch_glow_sheep','ch_distant_wind_1','ch_words_to_wind','ch_eye_of_storm','ch_leaky_cup','ch_distant_wind_2'
];
const STORY_GATE_JOURNEY_FLAGS = [
  'arrived_jikan','ch_black_name','ch_north_forest','ch_glow_sheep',
  'ch_distant_wind_1','ch_words_to_wind','ch_eye_of_storm','ch_leaky_cup','ch_distant_wind_2'
];
const STORY_GATE_BY_SCENE = {
  s_first_word:['ch_first_word'],
  s_alice_born:['ch_alice_born'],
  s_child_days:['ch_child_days'],
  s_age4:['ch_age4'],
  s_yaoshen:['ch_yaoshen'],
  s_sisters_grow:['ch_sisters_grow'],
  s_reno_arrive:['ch_reno_arrive'],
  s_alice_affinity:['ch_alice_affinity'],
  s_beatrice_day:['ch_beatrice_day'],
  s_micro:['ch_micro'],
  s_alice_wind_teach:['ch_alice_wind'],
  s_beatrice_leaves:['ch_beatrice_leaves'],
  s_academy_start:['ch_academy'],
  s_opening_ceremony:['ch_opening_ceremony'],
  s_noelle_meet:['met_noelle'],
  s_aino_meet:['met_aino'],
  s_charlotte_meet:['met_charlotte'],
  s_helena:['ch_helena'],
  s_aino_sparring:['ch_aino_sparring'],
  s_ajun:['met_ajun'],
  s_ice_melt_1:['ch_ice_melt_1'],
  s_seven_mountains:['ch_seven_mountains'],
  s_ice_melt_2:['ch_ice_melt_2'],
  s_beach:['ch_beach'],
  s_tree:['ch_tree'],
  s_star_festival:['ch_star'],
  s_turnpoint:['did_turnpoint'],
  s_jikan_arrive:['arrived_jikan'],
  s_black_name:['ch_black_name'],
  s_north_forest:['ch_north_forest'],
  s_glow_sheep:['ch_glow_sheep'],
  s_distant_wind_1:['ch_distant_wind_1'],
  s_words_to_wind:['ch_words_to_wind'],
  s_eye_of_storm:['ch_eye_of_storm'],
  s_leaky_cup:['ch_leaky_cup'],
  s_distant_wind_2:['ch_distant_wind_2']
};

function markStoryGateCompleted(sceneId){
  const keys=STORY_GATE_BY_SCENE[sceneId]||[];
  let changed=false;
  keys.forEach(k=>{
    if(!flag(k)){ flag(k,1); changed=true; }
  });
  if(changed) save();
  return changed;
}

function migrateStorySave(raw){
  if(!raw || typeof raw!=='object') raw={};
  raw.flags=Object.assign({},raw.flags||{});
  if((raw.storyGateVersion||0) < STORY_GATE_VERSION){
    const ph=raw.phase||'prologue';
    const repairKeys=(ph==='journey'||ph==='finale')
      ? STORY_GATE_JOURNEY_FLAGS
      : ph==='academy'
        ? STORY_GATE_ACADEMY_FLAGS
        : STORY_GATE_FLAGS;
    repairKeys.forEach(k=>{ delete raw.flags[k]; });
    raw.storyPending=[];
    raw.storyGateVersion=STORY_GATE_VERSION;
    raw.flags.story_gate_repaired_v3=1;
  }
  if(!Array.isArray(raw.storyPending)) raw.storyPending=[];
  return raw;
}

function save(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){}
  if(typeof VNUx!=='undefined'&&VNUx.onAutoSave) VNUx.onAutoSave(S);
}
function load(){
  try{
    const r=localStorage.getItem(SAVE_KEY);
    if(r){
      const raw=migrateStorySave(JSON.parse(r));
      S=Object.assign(baseState(), raw);
      if(typeof BranchingDirector !== 'undefined' && BranchingDirector.ensureCausalState) BranchingDirector.ensureCausalState(S);
      if(typeof RelicsAndEvents !== 'undefined' && RelicsAndEvents.ensureRelicsState) RelicsAndEvents.ensureRelicsState(S);
      save();
      return true;
    }
  }catch(e){ console.error('load save',e); }
  return false;
}
function saveCodex(){ try { localStorage.setItem(CODEX_KEY, JSON.stringify(codex)); } catch(e){} }
function hasSave(){ return !!localStorage.getItem(SAVE_KEY); }

// ========== HUD / UI ==========
function updateHUD(){
  const named = flag('named');
  $('hud-name').textContent = !named ? '？？？' : (S.alias || '希尔维亚');
  $('hud-age').textContent = ageStr();
  $('hud-tier').textContent = tierName();
  if($('hud-gold-val')) $('hud-gold-val').textContent = S.gold;
  else $('hud-gold').textContent = S.gold;
  $('hud-date').textContent = dateStr();
  $('hud-tod').textContent = phaseName();
  const hpP=S.mhp?S.hp/S.mhp*100:0, mpP=S.mmp?S.mp/S.mmp*100:0, stP=S.mst?S.st/S.mst*100:0;
  $('hud-hp').style.width=hpP+'%'; $('hud-hp-num').textContent=`${S.hp}/${S.mhp}`;
  $('hud-mp').style.width=mpP+'%'; $('hud-mp-num').textContent=`${S.mp}/${S.mmp}`;
  $('hud-st').style.width=stP+'%'; $('hud-st-num').textContent=`${S.st}/${S.mst}`;
  const face = $('hud-face-img');
  const crest = $('hud-crest');
  if(!named){
    if(crest) crest.classList.remove('hidden');
    if(face){
      face.style.opacity = '0';
      face.style.filter = 'none';
      face.removeAttribute('src');
      face.alt = '';
    }
  } else {
    if(crest) crest.classList.add('hidden');
    if(face){
      face.style.opacity = '1';
      face.style.filter = 'none';
      const src = resolvePortrait('sylvia', 'normal');
      if(src){
        face.onerror = ()=>{
          FAILED_PORTRAIT_URLS.add(src);
          const fb = resolvePortraitFallback('sylvia', 'normal');
          if(fb && fb !== src){ face.onerror = null; face.src = fb; }
          else { face.style.opacity = '0'; if(crest) crest.classList.remove('hidden'); }
        };
        face.src = src;
      }
    }
  }
  show('btn-continue', hasSave());
  const codexNum = Object.keys(S.ach||{}).length || codex.eggs || 0;
  const ccEl = $('codex-count');
  if(ccEl){
    ccEl.textContent = `${codexNum}`;
    ccEl.classList.toggle('is-zero', codexNum <= 0);
  }
}

function setBG(cls){
  const bg=$('bg');
  const newCls = (cls||'bg-title').trim();
  // 同背景不重复切（也避免多余淡出淡入）
  if(bg.getAttribute('data-cls')===newCls) return;
  const apply=()=>{
    bg.className=''; bg.setAttribute('data-cls', newCls);
    (newCls||'bg-title').split(/\s+/).forEach(c=>bg.classList.add(c));
    bg.style.opacity='1';
  };
  if(bg.getAttribute('data-cls')){       // 已有背景 → 先淡出再切入（渐进渐出）
    bg.style.opacity='0';
    setTimeout(apply, 320);
  } else {
    apply();
  }
  // 不再在此自动切换音乐：场景 bgm 贯穿剧情，自由探索在进入地点时切
}

// ========== PORTRAITS ==========
var PORTRAIT_SLOTS = ['p-left','p-center','p-right','p-fourth'];
var stage = [];            // 当前在场立绘 [{id,emo,active}]，顺序=左→右
var stageSid = null;       // 当前所在场景id（用于场景切换时强制清台）
var curSpeakerId = null;   // 当前说话人 id（对话框小胸像用）
function clearPortraits(){
  // 立即隐藏全部（用于场景/自由探索重置）
  PORTRAIT_SLOTS.forEach(id=>{
    const el=$(id); if(!el) return;
    el.classList.add('hidden'); el.classList.remove('active','dim','ps-enter','ps-leave');
  });
  $('css-portraits').innerHTML='';
  stage = [];
}
// 单角色旁白聚焦：保留当前在场者(主导/对话者)，只把 focus 人高亮、其余置暗；focus 人不在场则追加
function applyStageFocus(f){
  const next = stage.map(s=>({ id:s.id, emo:s.id===f.id?(f.emo||s.emo):s.emo, active:s.id===f.id }));
  if(!next.some(s=>s.id===f.id)) next.push({ id:f.id, emo:f.emo||'normal', active:true });
  applyStage(next);
}
// 单人说：基于当前 stage，让说话人高亮、其余在场者置暗；说话人不在场则追加
function appendSpeaker(chId, emo){
  const next = stage.map(s=>({ id:s.id, emo:s.id===chId?(emo||s.emo):s.emo, active:s.id===chId }));
  if(!next.some(s=>s.id===chId)) next.push({ id:chId, emo:emo||'normal', active:true });
  return next;
}
// 应用一组立绘：diff 当前 stage → 保留在场者(仅切换高亮/置暗)，离场者淡出，入场者淡入
function applyStage(next){
  next = Array.isArray(next) ? next.slice(0,4) : [];
  if($('css-portraits')) $('css-portraits').innerHTML = '';
  // 1) 决定每个槽放谁（顺序=left→right）
  const n = Math.max(stage.length, next.length);
  for(let i=0;i<n;i++){
    const sid = PORTRAIT_SLOTS[i]; if(!sid) break;
    const el = $(sid); if(!el) continue;
    const want = next[i] || null;
    const have = stage[i] || null;
    if(want && have && want.id===have.id){
      // 同人：更新 emo/active，不重排、不闪
      setPortrait(el, want.id, want.emo, want.active!==false);
      if(el.classList.contains('ps-enter')) el.classList.remove('ps-enter');
    } else if(want){
      // 该槽换人/新增：若有立绘图则淡入，否则由 setPortrait 走 CSS 占位
      setPortrait(el, want.id, want.emo, want.active!==false);
      if(!el.classList.contains('hidden')){
        el.classList.remove('ps-leave');
        el.classList.add('ps-enter');
        requestAnimationFrame(()=>{ el.classList.remove('ps-enter'); });
      }
    } else if(have){
      // 该槽原本有人、现在空：淡出后隐藏
      el.classList.add('ps-leave');
      const _el=el;
      setTimeout(()=>{ if(_el.classList.contains('ps-leave')){ _el.classList.add('hidden'); _el.classList.remove('ps-leave'); } }, 240);
    }
  }
  // 2) 记录新 stage
  stage = next.map(w=>({ id:w.id, emo:w.emo, active: w.active!==false }));
  layoutPortraits();
}
function attachPortraitFallback(img, el, charId, emotion, active, onMissingAll){
  img.onerror = ()=>{
    const failedSrc = img.getAttribute('src') || '';
    if(failedSrc) FAILED_PORTRAIT_URLS.add(failedSrc);
    const fb = resolvePortraitFallback(charId, emotion);
    if(fb && fb !== failedSrc && !FAILED_PORTRAIT_URLS.has(fb)){
      img.onerror = ()=>{
        FAILED_PORTRAIT_URLS.add(fb);
        if(typeof onMissingAll === 'function') onMissingAll();
      };
      img.src = fb;
      if(el && typeof BranchingDirector !== 'undefined' && BranchingDirector.syncStageEmotionBadge){
        BranchingDirector.syncStageEmotionBadge(el, charId, emotion || 'normal');
      }
      return;
    }
    if(typeof onMissingAll === 'function') onMissingAll();
  };
}
function setPortrait(el, charId, emotion, active){
  const emo = emotion || 'normal';
  const file = (typeof resolvePortrait==='function') ? resolvePortrait(charId, emo) : (PORTRAIT_FILES[charId+'_'+emo]||PORTRAIT_FILES[charId+'_normal']);
  if(!file){ el.classList.add('hidden'); addCssPortrait(charId, active); return; }
  const img = el.querySelector('img'); const nm = el.querySelector('.p-name');
  if(charId==='sylvia' && !flag('named')){ el.classList.add('hidden'); return; }
  attachPortraitFallback(img, el, charId, emo, active, ()=>{
    el.classList.add('hidden');
    addCssPortrait(charId, active);
  });
  img.src = file;
  el.setAttribute('data-char', charId||'');
  el.setAttribute('data-emo', emo);
  el.classList.remove('hidden');
  nm.textContent = (charId==='sylvia' && !flag('named')) ? '？？？' : (CHARS[charId]?.short || charId);
  el.classList.toggle('active', active); el.classList.toggle('dim', !active);
  if(typeof BranchingDirector !== 'undefined' && BranchingDirector.syncStageEmotionBadge){
    BranchingDirector.syncStageEmotionBadge(el, charId, emo);
  }
}
// 自适应立绘排布：按实际在场人数 N 分布（1/2/3/4 人各自居中/均匀），
// 避免「固定槽位填空」的机械感。人数越多越向两侧展开，人数少则更居中。
function layoutPortraits(){
  // 以 stage 为基准（在场人数决定排布），避免淡出中的立绘仍被计导致错位
  const N = stage.length;
  if(N === 0) return;
  const PRESET = {
    1: [50],
    2: [30, 70],
    3: [20, 50, 80],
    4: [14, 38, 62, 86],
  }[N] || Array.from({length:N},()=>50);
  for(let i=0;i<N;i++){
    const el = $(PORTRAIT_SLOTS[i]); if(!el) continue;
    el.style.left = (PRESET[i] ?? 50) + '%';
  }
}
function showPortrait(charId, emotion='normal', slot='center', active=true){
  const emo = emotion || 'normal';
  const file = (typeof resolvePortrait==='function') ? resolvePortrait(charId, emo) : (PORTRAIT_FILES[charId+'_'+emo]||PORTRAIT_FILES[charId+'_normal']);
  const el = $(slot==='left'?'p-left':slot==='right'?'p-right':slot==='fourth'?'p-fourth':'p-center');
  if(!el) return;
  // 记录当前角色，供 CSS 按角色微调立绘表现（如爱丽丝白色系高亮偏亮）
  el.setAttribute('data-char', charId||'');
  const img = el.querySelector('img');
  const nm = el.querySelector('.p-name');
  // 未命名前不显示主角立绘
  if(charId==='sylvia' && !flag('named')){
    el.classList.add('hidden');
    return;
  }
  if(file){
    attachPortraitFallback(img, el, charId, emo, active, ()=>{
      el.classList.add('hidden');
      addCssPortrait(charId, active);
    });
    img.src = file;
    el.setAttribute('data-emo', emo);
    el.classList.remove('hidden');
    nm.textContent = (charId==='sylvia' && !flag('named')) ? '？？？' : (CHARS[charId]?.short || charId);
    el.classList.toggle('active', active); el.classList.toggle('dim', !active);
    if(typeof BranchingDirector !== 'undefined' && BranchingDirector.syncStageEmotionBadge){
      BranchingDirector.syncStageEmotionBadge(el, charId, emo);
    }
  } else {
    el.classList.add('hidden'); addCssPortrait(charId, active);
  }
}
function addCssPortrait(charId, active=true){
  const c = CSS_CHARS[charId] || CSS_CHARS.sylvia;
  const d = document.createElement('div');
  d.className = `css-p ${CHARS[charId]?.css||charId}${active?'':' dim'}`;
  d.setAttribute('data-char', charId||'');
  d.innerHTML = `<div class="face">${c[1]||''}</div><div class="cn">${c[0]}</div>`;
  if(S.freeRoam){
    d.style.pointerEvents = 'auto';
    d.style.cursor = 'pointer';
    d.onclick = (e)=>{
      e.stopPropagation();
      if(!S.freeRoam) return;
      sfx('click');
      talkTo(charId);
    };
  }
  $('css-portraits').appendChild(d);
}
function setSpeaker(name, charId){
  const sp=$('speaker');
  if(name){ sp.textContent=name; sp.classList.remove('hidden'); }
  else sp.classList.add('hidden');
  const tb=$('tb-speaker'); if(!tb) return;
  const img=$('tb-speaker-img'), nm=$('tb-speaker-name'), box=$('text-box');
  if(name){
    tb.classList.remove('hidden');
    nm.textContent = name;
    let id = charId || speakerIdFromName(name);
    const src = id ? resolvePortrait(id, 'normal') : null;
    if(src){
      attachPortraitFallback(img, null, id, 'normal', true, ()=>{
        img.removeAttribute('src');
        img.style.display = 'none';
        img.style.opacity = '0';
        if(box) box.classList.remove('has-cameo');
      });
      img.src = src;
      img.style.display = '';
      img.style.opacity = '1';
    } else {
      img.onerror = null;
      img.removeAttribute('src');
      img.style.display = 'none';
      img.style.opacity = '0';
    }
    const trimName = String(name).trim();
    const isMystery = /^[？?]+$/.test(trimName) || trimName === '???';
    let onStage = false;
    try{
      const visibleSlots = document.querySelectorAll('#portraits .p-slot:not(.hidden):not(.ps-leave)');
      if(id){
        visibleSlots.forEach(s => { if(s.getAttribute('data-char') === id) onStage = true; });
      }
      if(isMystery && visibleSlots.length > 0) onStage = true;
    }catch(e){}
    tb.classList.toggle('stage-dup', !!onStage);
    tb.classList.toggle('is-mystery', isMystery);
    if(box) box.classList.toggle('has-cameo', !!(src && !onStage && !isMystery));
  } else {
    tb.classList.add('hidden');
    tb.classList.remove('stage-dup', 'is-mystery');
    if(box) box.classList.remove('has-cameo');
  }
}
// 名字 → 角色 id（用于小胸像）
function speakerIdFromName(name){
  if(!name) return null;
  const map = {'希尔维亚':'sylvia','渔':'sylvia','眷寒渔':'sylvia','贝阿特丽丝':'beatrice','贝蒂':'beatrice','爱丽丝':'alice','索菲亚':'sophia','克劳德':'claude'};
  if(map[name]) return map[name];
  // 其余角色按 CHARS.short / CHARS.name 反查
  for(const id in CHARS){ if(CHARS[id].short===name || CHARS[id].name===name) return id; }
  return null;
}

// ========== TEXT ENGINE ==========
var lineCB = null;
var typeDoneCB = null;
var lineGen = 0;
var awaitingChoice = false;
var afterPick = null; // 勇者之赐选卡后，继续播放的剩余台词 {rest, done}
var roamPromptDone = null; // 自由探索提示由右下角三角关闭后执行

// 自由探索提示与剧情打字机共用一个对话框；每次切换模式必须清掉旧推进状态，
// 否则右下角三角会被残留的 lineCB 当成普通剧情点击，季度剧情门控就不会执行。
function resetDialogAdvanceState(){
  clearInterval(typeTimer);
  typing = false;
  lineCB = null;
  typeDoneCB = null;
  fullText = '';
  textIdx = 0;
}

// 按完整文本估算实际显示行数；无底部 UI 时依 1—3 行垂直居中
function setDialogRows(str){
  const tb=$('text-box'), text=$('text');
  if(!tb || !text) return 1;
  tb.classList.remove('dialog-rows-1','dialog-rows-2','dialog-rows-3','dialog-rows-4');
  const raw=String(str ?? '');
  let rows=Math.max(1, raw.split('\n').length);
  try{
    const width=text.clientWidth;
    if(width>0){
      const cs=getComputedStyle(text);
      const probe=document.createElement('div');
      probe.style.position='absolute';
      probe.style.visibility='hidden';
      probe.style.pointerEvents='none';
      probe.style.width=width+'px';
      probe.style.fontFamily=cs.fontFamily;
      probe.style.fontSize=cs.fontSize;
      probe.style.fontWeight=cs.fontWeight;
      probe.style.letterSpacing=cs.letterSpacing;
      probe.style.lineHeight=cs.lineHeight;
      probe.style.whiteSpace='pre-wrap';
      probe.style.wordBreak='break-word';
      probe.textContent=raw;
      tb.appendChild(probe);
      const lh=parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize)||24)*1.55;
      rows=Math.max(rows, Math.ceil(probe.scrollHeight/lh));
      probe.remove();
    }
  }catch(e){}
  rows=clamp(rows,1,3);
  tb.classList.add('dialog-rows-'+rows);
  return rows;
}

const BACKLOG_LOG = [];
function recordBacklog(spk, txt){
  const t = String(txt || '').trim();
  if(!t || t === '请选择：') return;
  const s = spk ? String(spk).trim() : '';
  const prev = BACKLOG_LOG[BACKLOG_LOG.length - 1];
  if(prev && prev.spk === s && prev.txt === t) return;
  BACKLOG_LOG.push({ spk: s, txt: t });
  if(BACKLOG_LOG.length > 160) BACKLOG_LOG.shift();
}
function openBacklog(){
  const body = $('backlog-body');
  if(!body) return;
  if(!BACKLOG_LOG.length){
    body.innerHTML = '<p style="opacity:.68;padding:12px 4px">尚未记录台词。进入剧情后可在此随时回顾最近 160 条对白与旁白。</p>';
  } else {
    body.innerHTML = BACKLOG_LOG.map(item => `
      <div class="backlog-entry${item.spk ? ' has-spk' : ''}">
        ${item.spk ? `<div class="backlog-spk">${escapeText(item.spk)}</div>` : ''}
        <div class="backlog-txt">${escapeText(item.txt)}</div>
      </div>
    `).join('');
  }
  show('backlog-overlay', 1);
  try{
    const sc = $('backlog-overlay')?.querySelector('.modal-scroll');
    if(sc) sc.scrollTop = sc.scrollHeight;
  }catch(e){}
  sfx('open');
}

let currentTypeSpeed = 'normal'; // 'slow' | 'normal' | 'fast' | 'instant'
function setTypeSpeed(mode){
  const valid = ['slow','normal','fast','instant'];
  currentTypeSpeed = valid.includes(mode) ? mode : 'normal';
  return currentTypeSpeed;
}
function getTypeSpeed(){ return currentTypeSpeed; }
function typeSpeedParams(){
  if(currentTypeSpeed === 'slow') return { step: 1, ms: 26 };
  if(currentTypeSpeed === 'fast') return { step: 4, ms: 12 };
  if(currentTypeSpeed === 'instant') return { step: 9999, ms: 0 };
  return { step: 2, ms: 16 };
}
function notifyVNUxLineComplete(){
  if(typeof VNUx !== 'undefined' && VNUx.onLineComplete){
    try { VNUx.onLineComplete({ sceneId: currentScene || '', text: fullText || '', awaitingChoice: !!awaitingChoice, freeRoam: !!S.freeRoam }); } catch(e){}
  }
}

function typeText(str, cb){
  const box = $('text');
  fullText = String(str ?? '');
  const curTbSpk = ($('tb-speaker') && !$('tb-speaker').classList.contains('hidden') && $('tb-speaker-name'))
    ? $('tb-speaker-name').textContent
    : '';
  recordBacklog(curTbSpk, fullText);
  setDialogRows(fullText);
  textIdx = 0;
  typing = true;
  typeDoneCB = cb || null;
  lineCB = null; // IMPORTANT: never auto-advance; only arm after click finishes type
  box.innerHTML = '';
  clearInterval(typeTimer);
  const finishTyping = ()=>{
    clearInterval(typeTimer);
    typing = false;
    box.innerHTML = escapeText(fullText);
    lineCB = ()=>{
      const c = typeDoneCB;
      typeDoneCB = null;
      lineCB = null;
      if(c) c();
    };
    notifyVNUxLineComplete();
  };
  if(!fullText || currentTypeSpeed === 'instant'){
    finishTyping();
    return;
  }
  const sp = typeSpeedParams();
  // reveal gradually; when finished STAY until user clicks
  typeTimer = setInterval(()=>{
    if(textIdx >= fullText.length){
      finishTyping();
      return;
    }
    textIdx = Math.min(fullText.length, textIdx + sp.step);
    box.innerHTML = escapeText(fullText.slice(0, textIdx));
    if(box.parentElement) box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }, sp.ms);
}

function escapeText(s){
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
}

function skipType(){
  if(!typing) return false;
  clearInterval(typeTimer);
  typing = false;
  $('text').innerHTML = escapeText(fullText);
  // Arm continue on NEXT click — do not auto-run next line
  lineCB = ()=>{
    const c = typeDoneCB;
    typeDoneCB = null;
    lineCB = null;
    if(c) c();
  };
  notifyVNUxLineComplete();
  return true;
}

function advanceDialog(){
  if(awaitingChoice) return;
  // If still typing: complete the line only (stay on this message)
  if(typing){
    skipType();
    return;
  }
  // Message fully shown: go next
  if(lineCB){
    const fn = lineCB;
    lineCB = null;
    try { fn(); } catch(err){ console.error('lineCB error', err); enterFreeRoam(); }
  }
}

function applyLineEffects(L){
  if(!L || typeof L === 'string') return;
  if(L.bg) setBG(L.bg);
  if(L.loc){ S.loc = L.loc; updateLocBar(); }
  // 行级 bgm：在场景内切换地点/背景时可强制指定并锁定 BGM，防止引擎误判为自由探索而切回 peaceful
  if(L.bgm){ bgmSceneStart(L.bgm); }
  // 记录当前说话人 id（用于对话框左侧小胸像）：单人说=L.ch；DUO/portraits=active 者
  curSpeakerId = L.ch || null;
  if(L.portraits && L.portraits.length){ const act=L.portraits.find(p=>p.active!==false); if(act) curSpeakerId = act.id; }
  if(L.portraits){
    const arr = L.portraits.map(p=>({ id:p.id, emo:p.emo||'normal', active:p.active!==false }));
    // 单角色旁白(N)：视为「本段聚焦该人」，替换舞台为该人（vignette 段切换）；
    // 若需在多人对话中特写某动作同时保留主导者，剧情数据应写成 2 元素数组（聚焦人+主导者）。
    applyStage(arr);
  } else if(L.ch){
    // 单人说：保留当前在场立绘（非说话人置暗，不消除），说话人高亮；若说话人不在场则加入
    applyStage(appendSpeaker(L.ch, L.emo||'normal'));
    if(!L.speaker && CHARS[L.ch]) L.speaker = CHARS[L.ch].short;
  } else if(L.bg && stage.length){
    // 切换了背景但本行没有显式立绘指令（纯旁白/事件转换）：视为进入新场景事件，回收立绘
    applyStage([]);
  }
  if(L.sfx) sfx(L.sfx);
  if(L.flag) flag(L.flag, L.flagV !== undefined ? L.flagV : true);
  if(L.love) love(L.love, L.loveD||1);
  if(L.know) know(L.know, L.knowD||5);
  if(L.exp) addExp(L.exp);
  if(L.task) doneTask(L.task);
  if(L.ach) ach(L.ach);
  if(L.item) addItem(L.item);
  if(L.gold) S.gold += L.gold;
  if(L.st) S.st = clamp(S.st + L.st, 0, S.mst);
  if(L.hp) S.hp = clamp(S.hp + L.hp, 0, S.mhp);
  if(L.mp) S.mp = clamp(S.mp + L.mp, 0, S.mmp);
  if(L.unlock){
    (Array.isArray(L.unlock)?L.unlock:[L.unlock]).forEach(u=>{ if(LOCS[u]) LOCS[u].unlock = true; });
  }
  if(L.phase) S.phase = L.phase;
  updateHUD();
}

function playLines(lines, done){
  const gen = ++lineGen;
  let i = 0;
  const list = Array.isArray(lines) ? lines : [];
  S.freeRoam = false;
  awaitingChoice = false;
  show('action-bar', 0);
  show('hotspots', 0);
  const dialogBox = $('text-box');
  if(dialogBox){ dialogBox.classList.remove('dialog-hidden'); dialogBox.removeAttribute('data-roam-prompt'); dialogBox.removeAttribute('data-greeting-char'); }
  document.body.classList.remove('roam');   // 剧情：恢复完整高度对话框
  $('portraits')?.classList.remove('roam-npc');
  const ch = $('choices'); if(ch) ch.innerHTML = '';
  lineCB = null;

  function finish(){
    if(gen !== lineGen) return;
    lineCB = null;
    awaitingChoice = false;
    if(typeof done === 'function'){
      try { done(); } catch(e){ console.error(e); enterFreeRoam(); }
    } else if(!S.freeRoam){
      // never leave the player with a dead text box
      enterFreeRoam();
    }
  }

  function next(){
    if(gen !== lineGen) return;
    lineCB = null;
    awaitingChoice = false;

    while(i < list.length){
      let L = list[i++];

      // 防御：只要本场景仍是「视角」场景，每渲染一行都重新确保 HUD/地点标隐藏
      // （避免某些渲染/刷新路径中途把 pov 状态清掉，导致「实际游玩不隐藏 UI」）
      const sc0 = SCENES[currentScene];
      if(sc0 && sc0.pov) setPov(true);

      // plain string
      if(typeof L === 'string'){
        setSpeaker(null);
        if(typeof VNUx!=='undefined'&&VNUx.recordLine) VNUx.recordLine(null, L);
        typeText(L, ()=>{ if(gen===lineGen) next(); });
        return;
      }
      if(!L || typeof L !== 'object') continue;

      // 若此前处于 CG 演出、但本行不是 CG 行，则自动退出 CG 模式
      if(cgActive && L.cg === undefined && !L.choices && !L.freeRoam && !L.card){
        cgHide();
      }

      // 条件行：不满足则跳过
      if(typeof L.if === 'function'){
        let ok = true;
        try { ok = !!L.if(); } catch(e){ console.error('line.if', e); }
        if(!ok) continue;
      }

      // run do first
      if(typeof L.do === 'function'){
        try { L.do(); } catch(e){ console.error('line.do', e); }
      }

      // 动态文本
      if(typeof L.text === 'function'){
        let t = '';
        try { t = L.text(); } catch(e){ console.error('line.text', e); }
        L = Object.assign({}, L, {text: t});
      }

      applyLineEffects(L);

      // ===== CG 演出：全屏图 + 彩色台词 + 点击推进 =====
      if(L.cg){
        if(L.cg === 'end'){
          cgHide();                          // cg:'end' 退出 CG，继续渲染本行的普通文本（fall through）
        } else {
          cgShow(L.cg);                          // 显示对应 CG 图
          // 台词：ch 为说话人（彩色），否则为旁白（白色），逐字快速打出
          const isNarr = !L.ch;
          const spk = L.speaker || (L.ch ? CHARS[L.ch]?.short : null);
          if(typeof VNUx!=='undefined'&&VNUx.recordLine) VNUx.recordLine({ speaker: spk, charId: L.ch || curSpeakerId, text: L.text || '', kind: 'cg' });
          cgTextType(spk, L.text || '', isNarr, ()=>{   // 打字完成后的回调
            if(gen!==lineGen) return;
            $('cg-screen').onclick = ()=>{ $('cg-screen').onclick=null; if(gen===lineGen) next(); };
          });
          // 打字过程中点击：立刻补全整句（不推进），等再次点击才推进
          const cgAdvance = ()=>{
            if(cgTyping){
              cgTyping=false;
              $('cg-screen').onclick = null;
              // 立即显示完整台词并进入“点一下推进”状态
              const box=$('cg-text');
              box.innerHTML = cgSpeakerHtml + cgLineHtml;
              $('cg-screen').onclick = ()=>{ $('cg-screen').onclick=null; if(gen===lineGen) next(); };
              return;
            }
            $('cg-screen').onclick = null;
            if(gen===lineGen) next();
          };
          $('cg-screen').onclick = cgAdvance;
          return;
        }
      }
      // cg:'end' 时继续走下面的普通文本渲染

      // chapter card — pause then continue this line's text or next
      if(L.card){
        showCard(L.card.vol, L.card.t, L.card.s, ()=>{
          if(gen !== lineGen) return;
          if(L.text){
            setSpeaker(L.speaker||null, curSpeakerId);
            if(typeof VNUx!=='undefined'&&VNUx.recordLine) VNUx.recordLine(L.speaker||null, L.text);
            typeText(L.text, ()=>{ if(gen===lineGen) next(); });
          } else next();
        });
        return;
      }

      if(L.choices){
        awaitingChoice = true;
        setSpeaker(L.speaker||null, curSpeakerId);
        if(typeof VNUx!=='undefined'&&VNUx.recordLine&&L.text) VNUx.recordLine(L.speaker||null, L.text);
        clearInterval(typeTimer);
        typing = false;
        typeDoneCB = null;
        lineCB = null;
        fullText = String(L.text || '请选择：');
        setDialogRows(fullText);
        $('text').innerHTML = escapeText(fullText);
        const rest = list.slice(i);
        const resumeRest = (rest.length || done) ? ()=>{
          if(rest.length) playLines(rest, done);
          else if(done) done();
        } : null;
        const rawChoices = typeof L.choices === 'function' ? L.choices() : (L.choices || []);
        const wrappedChoices = (Array.isArray(rawChoices) ? rawChoices : []).map(c=>{
          if(!c || c.goto || c.done || !resumeRest) return c;
          if(c.lines) return Object.assign({}, c, { done: resumeRest });
          return Object.assign({}, c, {
            done: ()=>{
              if(S.freeRoam || typing || lineCB || awaitingChoice) return;
              if(!$('pick-screen').classList.contains('hidden')) return;
              if(!$('battle-screen').classList.contains('hidden')) return;
              if(!$('duel-screen').classList.contains('hidden')) return;
              resumeRest();
            }
          });
        });
        showChoices(wrappedChoices, resumeRest || (()=>{}));
        return;
      }

      if(L.goto){ runScene(L.goto); return; }

      if(L.freeRoam){
        if(L.text){
          setSpeaker(L.speaker||null, curSpeakerId);
          if(typeof VNUx!=='undefined'&&VNUx.recordLine) VNUx.recordLine({ speaker: L.speaker||null, charId: curSpeakerId, text: L.text });
          typeText(L.text, ()=>{
            if(gen !== lineGen) return;
            enterFreeRoam();
          });
        } else {
          enterFreeRoam();
        }
        return;
      }

      if(L.pickTier != null){
        // 该等阶的「勇者之赐」已经选过：直接跳过，不要卡住剧情
        if(S.picksDone.includes(L.pickTier)) continue;
        flag('resume_after_pick', 1);
        // 选卡结束后，继续播放本场景剩下的台词
        afterPick = { rest: list.slice(i), done: done };
        triggerBraveGift(L.pickTier);
        return;
      }

      if(L.battle){
        startBattle(L.battle, ()=>{ if(gen===lineGen) next(); });
        return;
      }

      if(L.wait){
        setTimeout(()=>{ if(gen===lineGen) next(); }, L.wait);
        return;
      }

      // text line
      if(L.text){
        setSpeaker(L.speaker||null, curSpeakerId);
        if(typeof VNUx!=='undefined'&&VNUx.recordLine) VNUx.recordLine({ speaker: L.speaker||null, charId: curSpeakerId, text: L.text });
        typeText(L.text, ()=>{ if(gen===lineGen) next(); });
        return;
      }

      // do-only / effect-only line → fall through while loop
    }

    // exhausted
    finish();
  }

  next();
}

function showChoices(choices, onEmpty){
  const box = $('choices');
  box.innerHTML = '';
  awaitingChoice = true;
  let list = [];
  try { list = typeof choices === 'function' ? choices() : (choices || []); }
  catch(e){ console.error(e); list = []; }
  if(!Array.isArray(list)) list = [];

  const visible = list.filter(c=> c && (!c.if || c.if()));
  if(!visible.length){
    awaitingChoice = false;
    if(onEmpty) onEmpty();
    else enterFreeRoam();
    return;
  }

  visible.forEach(c=>{
    const b = document.createElement('button');
    b.className = 'choice' + (c.cls ? (' '+c.cls) : '');
    let reason = c.reason || '';
    if(typeof c.disabled === 'function') c = Object.assign({}, c, {disabled: c.disabled()});
    b.innerHTML = c.text + (reason && c.disabled ? `<span class="reason">${reason}</span>` : (reason && !c.disabled ? '' : (c.disabled && reason ? `<span class="reason">${reason}</span>`:'')));
    if(c.disabled){
      b.disabled = true;
      if(reason) b.innerHTML = c.text + `<span class="reason">${reason}</span>`;
    }
    b.onclick = ()=>{
      if(b.disabled) return;
      sfx('click');
      if(typeof VNUx!=='undefined'&&VNUx.recordChoice) VNUx.recordChoice(c.text);
      awaitingChoice = false;
      box.innerHTML = '';
      try {
        if(c.lines){ if(c.do) c.do(); playLines(c.lines, c.done); return; }
        if(c.goto){ if(c.do) c.do(); runScene(c.goto); return; }
        if(c.do) c.do();
        if(c.done){ c.done(); return; }
        // do() 可能已 enterFreeRoam / runScene / playLines；稍晚仅在仍卡住时兜底
        const genAtClick = lineGen;
        setTimeout(()=>{
          if(lineGen !== genAtClick) return; // 已开启新对话流
          if(S.freeRoam) return;
          if(typing || lineCB || awaitingChoice) return;
          if(!$('pick-screen').classList.contains('hidden')) return;
          if(!$('battle-screen').classList.contains('hidden')) return;
          if(!$('duel-screen').classList.contains('hidden')) return;
          if($('ai-drawer') && !$('ai-drawer').classList.contains('hidden')) return;
          if($('choices').children.length) return;
          enterFreeRoam();
        }, 100);
      } catch(err){
        console.error('choice error', err);
        enterFreeRoam();
      }
    };
    box.appendChild(b);
  });
}

// click text box / stage to advance
function dismissRoamPrompt(){
  const tb=$('text-box');
  if(!tb || !S.freeRoam || !tb.hasAttribute('data-roam-prompt') || typing || awaitingChoice) return false;
  const promptKind=tb.getAttribute('data-roam-prompt');
  const greetingChar=tb.getAttribute('data-greeting-char');
  if(promptKind==='greeting' && greetingChar) markRoamGreetingDismissed(greetingChar);
  const afterPrompt=roamPromptDone;
  roamPromptDone=null;
  resetDialogAdvanceState();
  tb.classList.add('dialog-hidden');
  tb.classList.remove('season-flavor');
  tb.removeAttribute('data-roam-prompt');
  tb.removeAttribute('data-greeting-char');
  $('text').innerHTML='';
  setSpeaker(null);
  document.querySelectorAll('#portraits .p-slot').forEach(el=>{
    if(el.classList.contains('hidden')) return;
    el.classList.add('active'); el.classList.remove('dim');
  });
  save();

  // 季度提示关闭后直接从存档队列启动剧情；不再依赖临时回调变量。
  if(promptKind==='season'){
    if(resumePendingStories()) return true;
    if(checkStoryGates()) return true;
    if(typeof afterPrompt==='function') afterPrompt();
    return true;
  }
  if(typeof afterPrompt==='function') afterPrompt();
  return true;
}

function bindAdvance(){
  const tb=$('text-box');
  if(!tb) return;
  const more=$('more');
  if(more){
    more.onclick=e=>{
      if(S.freeRoam && tb.hasAttribute('data-roam-prompt')){
        if(e && typeof e.stopPropagation==='function') e.stopPropagation();
        dismissRoamPrompt();
      }
    };
  }
  tb.onclick=e=>{
    if(e.target.closest('button')) return;
    if(S.freeRoam && tb.hasAttribute('data-roam-prompt') && !typing && !awaitingChoice){
      const dismiss=!!(e.target.closest && e.target.closest('#more'));
      if(dismiss) dismissRoamPrompt();
      return;
    }
    advanceDialog();
  };
}
bindAdvance();

// ========== CARD ==========
function showCard(vol, t, s, cb){
  $('card-vol').textContent=vol||'';
  $('card-t').textContent=t||'';
  $('card-s').textContent=s||'';
  show('card',1); sfx('page');
  let done=false;
  const finish=()=>{ if(done) return; done=true; show('card',0); if(cb) cb(); };
  const card=$('card');
  card.onclick=()=>{ finish(); card.onclick=null; };
}

// ========== CG 演出（情绪爆点：全屏图 + 彩色台词 + 点击推进） ==========
// 说话人 → CSS 配色类
const CG_CHAR_CLASS = {
  sylvia:'c-sylvia', claude:'c-claude', sophia:'c-sophia', reno:'c-reno',
  beatrice:'c-beatrice', alice:'c-alice',
};
function cgCharClass(ch){
  if(!ch) return 'c-narrator';
  if(ch==='sylvia'||ch==='希尔维亚'||ch==='希尔维亚·维斯特利亚') return 'c-sylvia';
  if(ch==='claude'||ch==='克劳德') return 'c-claude';
  if(ch==='sophia'||ch==='索菲亚') return 'c-sophia';
  if(ch==='reno'||ch==='雷纳德') return 'c-reno';
  if(ch==='beatrice'||ch==='贝阿特丽丝'||ch==='贝蒂') return 'c-beatrice';
  if(ch==='alice'||ch==='爱丽丝') return 'c-alice';
  return 'c-narrator';
}
const CG_FALLBACK_BG = {
  'vol3_jikan_parting.png': 'assets/bg/jikan.jpg',
};
let cgImage = null;   // 当前 CG 图（避免连续同图时重复设 background 导致闪烁）
function cgShow(name){
  // 隐藏全部 UI，显示全屏 CG
  cgActive = true;
  if(name){
    if(!S.unlockedCGs) S.unlockedCGs = {};
    S.unlockedCGs[name] = true;
    if(!codex.cgs) codex.cgs = {};
    if(!codex.cgs[name]){ codex.cgs[name] = true; saveCodex(); }
    if(typeof VNUx !== 'undefined' && VNUx.markCgUnlocked){
      try { VNUx.markCgUnlocked(name); } catch(e){}
    }
  }
  if(name !== cgImage){                 // 仅当图片变化时才重设背景，杜绝连续点击时的闪烁
    cgImage = name;
    const targetUrl = `assets/cg/${name}`;
    $('cg-bg').style.backgroundImage = `url(${targetUrl})`;
    // 若新 CG 尚未回流磁盘，浏览器端静默回退到对应场景高清底图，绝无黑屏裂图
    if(typeof Image !== 'undefined' && CG_FALLBACK_BG[name] && !(typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || ''))){
      const probe = new Image();
      probe.onerror = ()=>{
        if(cgImage === name && $('cg-bg')){
          $('cg-bg').style.backgroundImage = `url(${CG_FALLBACK_BG[name]})`;
        }
      };
      probe.src = targetUrl;
    }
  }
  $('cg-bg').classList.remove('noimg');
  const cs=$('cg-screen');
  if(cs.classList.contains('hidden')){  // 首次进入 CG：淡入
    cs.classList.add('faded');           // 从透明开始
    show(cs, 1);
    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ cs.classList.remove('faded'); }); });
  }
  if(!document.body.classList.contains('cg-mode')) document.body.classList.add('cg-mode');
}
let cgTyping = false;      // CG 台词是否正在逐字打出
let cgSpeakerHtml = '';    // 当前 CG 说话人 HTML（打字补全用）
let cgLineHtml = '';       // 当前 CG 完整台词 HTML
function cgBuildHtml(speaker, text, isNarrator){
  const cls = cgCharClass(isNarrator ? null : speaker);
  return {
    spk: (speaker && !isNarrator ? `<div class="cg-speaker ${cls}">${escapeText(speaker)}</div>` : ''),
    line: `<div class="cg-line ${cls}">${escapeText(text)}</div>`,
  };
}
// CG 台词逐字快速打出（与一般对话打字机速度一致）
function cgTextType(speaker, text, isNarrator, done){
  const box = $('cg-text');
  const { spk, line } = cgBuildHtml(speaker, text, isNarrator);
  cgSpeakerHtml = spk; cgLineHtml = line;
  const full = text || '';
  if(!full || currentTypeSpeed === 'instant'){ box.innerHTML = spk + line; if(done) done(); return; }
  cgTyping = true;
  let idx = 0;
  const sp = typeSpeedParams();
  box.innerHTML = spk + `<div class="cg-line ${cgCharClass(isNarrator?null:speaker)}"></div>`;
  const timer = setInterval(()=>{
    if(!cgTyping){ clearInterval(timer); return; }
    idx = Math.min(full.length, idx + sp.step);
    box.innerHTML = spk + `<div class="cg-line ${cgCharClass(isNarrator?null:speaker)}">${escapeText(full.slice(0,idx))}</div>`;
    if(idx >= full.length){
      clearInterval(timer); cgTyping = false;
      box.innerHTML = spk + line;
      if(done) done();
    }
  }, sp.ms);
}
function cgText(speaker, text, isNarrator){
  // 立即显示完整（用于测试/兜底）
  const box = $('cg-text');
  const { spk, line } = cgBuildHtml(speaker, text, isNarrator);
  box.innerHTML = spk + line;
}
let cgActive = false;
function cgHide(){
  cgActive = false;
  cgImage = null;
  cgTyping = false;
  const cs=$('cg-screen');
  if(cs && !cs.classList.contains('hidden')){
    cs.classList.add('faded');           // 淡出再隐藏
    setTimeout(()=>{ show(cs, 0); cs.classList.remove('faded'); }, 400);
  }
  document.body.classList.remove('cg-mode');
  $('cg-bg').style.backgroundImage = '';
  $('cg-text').innerHTML = '';
}

// ========== FREE ROAM ==========


function phaseAreaAllowed(area){
  const ph = S.phase;
  if(ph==='prologue' || ph==='childhood' || ph==='youth'){
    return area==='公爵府' || area==='领地' || area==='王都';
  }
  if(ph==='academy'){
    // 入学后不可自由回公爵府与领地（利维莫尔镇/海滨别墅等）
    return area==='魔法大学' || area==='王都';
  }
  if(ph==='journey' || ph==='finale'){
    // 旅途后不可自由回学院/公爵府
    return area==='旅途' || area==='澄岚镇' || area==='赫兰' || area==='王都';
  }
  return true;
}
function locAllowed(id){
  const L = LOCS[id];
  if(!L || !L.unlock) return false;
  return phaseAreaAllowed(L.area);
}

function canUseExit(ex){
  if(ex.needAge!=null && S.ageY < ex.needAge) return false;
  if(ex.needFlag && !flag(ex.needFlag)) return false;
  if(ex.needPhase && S.phase !== ex.needPhase) return false;
  // 未满1岁：不能自由走动（除非特殊 fuss 事件）
  if(S.ageY < 1 && !ex.babyFuss && !ex.allowInfant) return false;
  const L = LOCS[ex.to];
  if(!L) return false;
  if(!phaseAreaAllowed(L.area)) return false;
  if(!L.unlock){
    if(ex.needAge!=null && S.ageY >= ex.needAge) L.unlock = true;
    else if(ex.needAge==null && S.ageY >= 1) L.unlock = true;
  }
  return !!L.unlock && phaseAreaAllowed(L.area);
}

function doBabyFuss(toId, stCost){
  if(stCost>0 && !spendST(stCost)) return;
  const dest = LOCS[toId]?.name || toId;
  // 短暂被抱出去，再抱回育婴室
  const carrier = Math.random()<0.5 ? 'sophia' : 'beatrice';
  const cname = CHARS[carrier]?.short || '家人';
  playLines([
    {ch:carrier, speaker:cname, text: carrier==='beatrice' ? '欸——妹妹想出去？那、那姐姐抱你去看看！不能太久哦！' : '想看看外面吗？好，妈妈抱你出去一会儿。'},
    {text:`被${cname}抱出了育婴室。视野晃动，走廊的画像与窗外的光一晃而过。`, loc:toId, bg: LOCS[toId]?.bg},
    {ch:carrier, speaker:cname, text: carrier==='beatrice' ? '好了好了！看完了！姐姐胳膊酸了——回床上！' : '风有点凉。我们回去吧，小希尔维亚。'},
    {text:'又被稳稳抱回育婴室。纱帐、熟悉的天花板。外面的世界，只好等自己会走路。', loc:'nursery', bg:LOCS.nursery?.bg, freeRoam:true}
  ]);
}
const portraitAlphaCache = new WeakMap();
function portraitPixelIsOpaque(img, clientX, clientY){
  if(!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return true;
  const rect=img.getBoundingClientRect();
  if(!rect.width || !rect.height) return true;
  if(clientX<rect.left || clientX>rect.right || clientY<rect.top || clientY>rect.bottom) return false;
  try{
    const src=img.currentSrc || img.src || '';
    let hit=portraitAlphaCache.get(img);
    if(!hit || hit.src!==src || hit.nw!==img.naturalWidth || hit.nh!==img.naturalHeight){
      const scale=Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight));
      const w=Math.max(1,Math.round(img.naturalWidth*scale));
      const h=Math.max(1,Math.round(img.naturalHeight*scale));
      const canvas=document.createElement('canvas');
      canvas.width=w; canvas.height=h;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx) return true;
      ctx.drawImage(img,0,0,w,h);
      hit={src,nw:img.naturalWidth,nh:img.naturalHeight,w,h,ctx};
      portraitAlphaCache.set(img,hit);
    }
    const x=clamp(Math.floor((clientX-rect.left)/rect.width*hit.w),0,hit.w-1);
    const y=clamp(Math.floor((clientY-rect.top)/rect.height*hit.h),0,hit.h-1);
    return hit.ctx.getImageData(x,y,1,1).data[3]>=24;
  }catch(e){
    // 同源图片正常可读；若浏览器阻止 canvas 读取，则保守地仍把它视为角色本体。
    return true;
  }
}
function forwardPortraitClick(clientX,clientY){
  if(typeof document.elementFromPoint!=='function') return false;
  const slots=Array.from(document.querySelectorAll('#portraits .p-slot'));
  const previous=slots.map(el=>el.style.pointerEvents);
  slots.forEach(el=>{ el.style.pointerEvents='none'; });
  let under=null;
  try{ under=document.elementFromPoint(clientX,clientY); }
  finally{ slots.forEach((el,i)=>{ el.style.pointerEvents=previous[i]; }); }
  const hotspot=under && under.closest ? under.closest('.hotspot') : null;
  if(!hotspot) return false;
  hotspot.click();
  return true;
}

function renderHotspots(){
  const box = $('hotspots');
  if(!box) return;
  box.innerHTML = '';
  try{ while(box.firstChild) box.removeChild(box.firstChild); }catch(e){}
  if(!S.freeRoam){
    show(box,0);
    $('portraits')?.classList.remove('roam-npc');
    return;
  }
  let list = (EXITS[S.loc] || []).slice();
  if(S.ageY < 1 && S.loc === 'nursery'){
    list.push(
      {babyFuss:true, fussTo:'parlor', label:'闹着要出去', icon:'🍼', x:50, y:40, st:1},
      {babyFuss:true, fussTo:'hallway', label:'要看走廊', icon:'👶', x:82, y:52, st:1}
    );
  } else {
    // 非婴儿育婴室：绝不保留 fuss 出口
    list = list.filter(ex => !ex.babyFuss);
  }
  const usable = list.filter(ex => {
    if(ex.babyFuss) return S.ageY < 1 && S.loc === 'nursery';
    return canUseExit(ex);
  });
  if(S.loc === 'northforest'){
    usable.push({combatStage:'north_forest_hunt', label:'实战讨伐·群狼与影豺', icon:'⚔️', x:50, y:36});
  } else if(S.loc === 'training_field' && flag('met_aino') && !flag('ch_ice_melt_1')){
    usable.push({combatStage:'aino_sparring', label:'冰上实战·三击切磋', icon:'🧊', x:86, y:36});
  } else if(S.loc === 'ice_canyon' && flag('ch_distant_wind_2')){
    usable.push({combatStage:'hulan_beast_tide', label:'北境协防·冰封峡谷', icon:'🏔️', x:86, y:30});
  }
  const peeps = whoIsHere();
  // stage portraits for NPCs present
  clearPortraits();
  const pRoot = $('portraits');
  if(pRoot) pRoot.classList.add('roam-npc');
  const slots = ['left','center','right','fourth'];
  peeps.slice(0,4).forEach((id,i)=>{
    const slot = slots[i] || 'center';
    showPortrait(id, 'normal', slot, true);
    const el = $(slot==='left'?'p-left':slot==='right'?'p-right':slot==='fourth'?'p-fourth':'p-center');
    if(el){
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.onclick = (e)=>{
        e.stopPropagation();
        if(!S.freeRoam) return;
        const img=el.querySelector('img');
        // detail===0 表示键盘/脚本触发；真实指针点击才进行透明像素命中检测。
        const onCharacter=e.detail===0 || portraitPixelIsOpaque(img,e.clientX,e.clientY);
        if(!onCharacter){
          forwardPortraitClick(e.clientX,e.clientY);
          return;
        }
        sfx('click');
        talkTo(id);
      };
    }
  });
  stage = peeps.slice(0,4).map(id=>({id, emo:'normal', active:true})); // 供 layout 排布
  layoutPortraits();
  if(!usable.length && !peeps.length){
    show(box,0);
    if(typeof BranchingDirector !== 'undefined' && BranchingDirector.renderVignetteHotspots) BranchingDirector.renderVignetteHotspots();
    return;
  }
  show(box,1);
  // 计算当前在场立绘的水平中心（与 layoutPortraits 一致），用于热点避脸防遮挡
  const pCount = Math.min(4, peeps.length);
  const portraitXs = pCount === 1 ? [50] : pCount === 2 ? [30, 70] : pCount === 3 ? [20, 50, 80] : pCount >= 4 ? [14, 38, 62, 86] : [];
  usable.forEach((ex,i)=>{
    let hx = ex.x || (16 + i * 18);
    let hy = Math.max(17, Math.min(64, ex.y || 48));
    // 若热点落入立绘头部/五官区域（y 20..58 且与任一立绘中心水平距离 < 13%），自动避让至安全边缘或高空
    if(portraitXs.length && hy >= 20 && hy <= 58){
      for(const px of portraitXs){
        if(Math.abs(hx - px) < 13){
          if(px >= 60) hx = Math.min(90, Math.max(85, px + 18));
          else if(px <= 40) hx = Math.max(10, Math.min(15, px - 18));
          else hx = (i % 2 === 0) ? 13 : 87;
        }
      }
    }
    const b = document.createElement('button');
    b.className = 'hotspot' + (ex.egg?' egg':'') + (ex.babyFuss?' locked-baby':'');
    b.style.left = hx + '%';
    b.style.top = hy + '%';
    b.innerHTML = `<span class="hs-icon">${ex.icon||'✦'}</span>${ex.label||LOCS[ex.to]?.name||ex.to}`;
    b.onclick = (e)=>{
      e.stopPropagation();
      if(!S.freeRoam) return;
      sfx('click');
      if(ex.combatStage){ startBattle({stageId: ex.combatStage, fullRestore: true}, ()=>enterFreeRoam()); return; }
      if(ex.babyFuss){ doBabyFuss(ex.fussTo || 'parlor', ex.st || 0); return; }
      enterLoc(ex.to);
    };
    box.appendChild(b);
  });
  if(typeof BranchingDirector !== 'undefined' && BranchingDirector.renderVignetteHotspots) BranchingDirector.renderVignetteHotspots();
}

function setPov(on){
  document.body.classList.toggle('pov-hidden', !!on);
  // 直接内联隐藏/恢复 HUD 与地点标，确保「视角」一定生效（不依赖 CSS 特异性/缓存）
  const hud=$('hud'); if(hud){ hud.style.opacity = on ? '0' : ''; hud.style.pointerEvents = on ? 'none' : ''; }
  const lb=$('loc-bar'); if(lb){ lb.style.opacity = on ? '0' : ''; lb.style.pointerEvents = on ? 'none' : ''; }
}
function enterFreeRoam(options={}){
  // 到达自由探索代表当前场景已经完整结束；此时才提交门控完成标记。
  if(currentScene) markStoryGateCompleted(currentScene);
  // 若剧情链还有后续场景，则直接衔接，不进入自由行动
  if(storyChain && storyChain.idx < storyChain.queue.length){ stepChain(); return; }
  if(storyChain && storyChain.idx >= storyChain.queue.length) storyChain=null;
  S.storyPending=[];
  currentScene=null;
  resetDialogAdvanceState();
  // 「视角」场景结束：恢复顶部 HUD
  setPov(false);
  sceneBgmType = null;             // 场景结束，进入自由探索：允许按背景推断切回日常音乐
  roamPromptDone = null;
  S.freeRoam=true; awaitingChoice=false; show('action-bar',1); updateHUD(); updateLocBar(); save();
  document.body.classList.add('roam');
  const box=$('choices'); if(box) box.innerHTML='';
  setSpeaker(null);
  const nextBtn=document.querySelector('[data-act="next"]');
  if(nextBtn){
    const lbl=nextBtn.querySelector('.abtn-label');
    if(lbl) lbl.textContent = S.ageY < 1 ? '下一年' : '下个季度';
    else nextBtn.textContent = S.ageY < 1 ? '下一年' : '下个季度';
  }
  // 不再自动显示“点击出口移动”等地点教学对话框。
  const dialogBox=$('text-box');
  dialogBox.classList.add('dialog-hidden');
  dialogBox.classList.remove('season-flavor');
  dialogBox.removeAttribute('data-roam-prompt');
  dialogBox.removeAttribute('data-greeting-char');
  $('text').innerHTML = '';
  renderHotspots();
  // 由季度推进触发的剧情全部结束后，再补显示该季度的风物提示。
  if(showPendingSeasonFlavor()) return;
  if(!options.deferGreeting) maybeShowRoamGreeting();
}

const SEASON_FLAVOR = [
  '风物：新芽初醒。',
  '风物：蝉鸣入夏。',
  '风物：叶染浅金。',
  '风物：初雪落檐。'
];
function seasonFlavorText(season=S.season){
  const s=clamp(Number(season)||0,0,3);
  return dateStr()+'\n'+SEASON_FLAVOR[s];
}
function showSeasonFlavor(done){
  const tb=$('text-box');
  resetDialogAdvanceState();
  const text=seasonFlavorText();
  setSpeaker(null);
  setDialogRows(text);
  $('text').innerHTML=escapeText(text);
  tb.classList.remove('dialog-hidden');
  tb.classList.add('season-flavor');
  tb.setAttribute('data-roam-prompt','season');
  tb.removeAttribute('data-greeting-char');
  roamPromptDone = typeof done==='function' ? done : null;
  save();
  return text;
}
function showPendingSeasonFlavor(){
  if(!S.seasonFlavorPending) return false;
  S.seasonFlavorPending=false;
  showSeasonFlavor(()=>{
    updateHUD();
    renderHotspots();
  });
  return true;
}

function updateLocBar(){
  const L=LOCS[S.loc]; if(!L) return;
  show('loc-bar',1);
  $('loc-name').textContent = L.name;
  $('loc-desc').textContent = L.desc||'';
  setBG(L.bg||'bg-room');
  bgmFreeRoam(L.bg||'bg-room', S.phase, S.loc); // 自由探索才按背景切音乐
}
function enterLoc(id){
  const L=LOCS[id];
  if(!L||!L.unlock){ toast('还不能去那里'); return; }
  if(!phaseAreaAllowed(L.area)){ toast('这个阶段不能去那里'); return; }
  // 婴儿（<1岁）：不能自由移动（只能经 doBabyFuss 短暂被抱出）
  if(S.ageY < 1 && id !== 'nursery' && id !== 'ownroom'){ toast('你还太小，自己走不了。让家人抱你出去吧。'); return; }
  S.loc=id; if(L.tags?.includes('rest')) S.lastSafe=id;
  updateLocBar(); clearPortraits();
  if(tryLocEgg(id)) return;
  // 普通进入地点不再播放环境描述；自由探索会自动显示本季度尚未关闭的角色问候。
  enterFreeRoam();
}
const ROAM_PLACE_DETAIL = {
  nursery:'窗边的光很暖。', ownroom:'房间里很安静。', hallway:'走廊今天很安静。',
  parlor:'红茶刚泡好。', dining:'餐点还热着。', garden:'花园的风正好。',
  study:'书页上落着一小片阳光。', kitchen:'刚出炉的点心很香。', training:'风向正适合练习。',
  balcony:'露台的风有点凉。', chapel:'彩窗的光落在长椅上。', cellar:'这里比外面凉得多。',
  town:'街上比平时热闹。', beach:'海风把浪声送了过来。', dorm:'宿舍里难得安静。',
  library:'这里适合安静看书。', cafeteria:'今天的餐点闻起来不错。', water_class:'水元素正在空气里聚集。',
  ice_class:'教室里的温度刚刚好。', flowerhouse:'花坊的湿度正合适。', training_field:'训练场的风很干净。',
  memorial:'树影把石牌遮住了一半。', auditorium:'礼堂里的回声很清楚。', jikan:'院里的炉火还温着。',
  chenglan_guild:'告示板前聚着交接任务的冒险者。',
  northforest:'林子里的风声不太安稳。', road:'今天的路上没有太多尘土。',
  ice_canyon:'风雪顺着峡谷口呼啸而过。'
};
function roamGreetingText(charId, locId=S.loc){
  const a=S.ageY, n=CHARS[charId]?.short||charId;
  const detail=ROAM_PLACE_DETAIL[locId] || (LOCS[locId]?.name ? LOCS[locId].name+'今天很安静。' : '这里今天很安静。');
  switch(charId){
    case 'sophia': return a<1 ? '醒了吗？妈妈在。'+detail : a<6 ? '希尔维亚，想在这里待一会儿吗？'+detail : a<12 ? '希尔维亚，今天也来透透气吗？'+detail : '希尔维亚，难得回来，陪妈妈坐一会儿吧。'+detail;
    case 'beatrice': return a<1 ? '妹妹！看这里！'+detail : a<10 ? '希尔维亚！我正想找你！'+detail : '希尔维亚，来得正好！'+detail;
    case 'alice': return a<3 ? '……姐姐大人。'+detail : a<10 ? '……姐姐大人，你也来了。'+detail : '……姐姐大人。要一起待一会儿吗？'+detail;
    case 'claude': return a<6 ? '希尔维亚。看来你很喜欢这里。'+detail : '希尔维亚。既然来了，就别急着走。'+detail;
    case 'emma': return '希尔维亚！你也在这里！'+detail;
    case 'noelle': return '……来了？'+detail;
    case 'aino': return (locId==='ice_canyon' || flag('ch_distant_wind_2')) ? '……东侧风口刚巡完。'+detail : '……你来了。'+detail;
    case 'anna': return '希尔维亚同学，来得正好。'+detail;
    case 'hol': return '……嗯，你来了。'+detail;
    case 'charlotte': return '维斯特利亚。你来得倒巧。'+detail;
    case 'ajun': return '希尔维亚！正好碰见你！'+detail;
    case 'ji': return '来了？先歇口气。'+detail;
    case 'jilan': return '你来啦。'+detail;
    case 'masha': return '哟，渔，来接委托还是交材料？'+detail;
    default: return a<6 ? n+'弯下身向你打了声招呼。'+detail : n+'向你点了点头。'+detail;
  }
}
function roamGreetingQuarterKey(){
  return String(S.year||0)+':'+String(S.season||0);
}
function roamGreetingDismissed(charId){
  const all=flag('roam_greeting_dismissed');
  const quarter=all && typeof all==='object' ? all[roamGreetingQuarterKey()] : null;
  return !!(quarter && quarter[charId]);
}
function markRoamGreetingDismissed(charId){
  if(!charId) return;
  let all=flag('roam_greeting_dismissed');
  if(!all || typeof all!=='object' || Array.isArray(all)) all={};
  const key=roamGreetingQuarterKey();
  if(!all[key] || typeof all[key]!=='object') all[key]={};
  all[key][charId]=1;
  flag('roam_greeting_dismissed',all);
}
function maybeShowRoamGreeting(){
  const gs=$('game-screen'), tb=$('text-box'), action=$('action-bar'), choices=$('choices');
  if(!gs || gs.classList.contains('hidden')) return false;
  if(!S.freeRoam || S.phase==='prologue' || !document.body.classList.contains('roam')) return false;
  if(document.body.classList.contains('ui-hidden')) return false;
  if(!action || action.classList.contains('hidden')) return false;
  if(!tb || !tb.classList.contains('dialog-hidden')) return false;
  if(choices && choices.children.length) return false;
  const peeps=whoIsHere();
  if(!peeps.length) return false;
  const start=Math.abs((S.season||0)+S.ageY+String(S.loc||'').length)%peeps.length;
  for(let i=0;i<peeps.length;i++){
    const id=peeps[(start+i)%peeps.length];
    if(!roamGreetingDismissed(id)) return showRoamGreeting(id,S.loc);
  }
  return false;
}

function showRoamGreeting(charId, locId=S.loc){
  if(!charId || !CHARS[charId]) return false;
  resetDialogAdvanceState();
  const tb=$('text-box');
  const greeting=roamGreetingText(charId, locId);
  roamPromptDone=null;
  tb.classList.remove('season-flavor');
  setSpeaker(CHARS[charId].short, charId);
  setDialogRows(greeting);
  $('text').innerHTML=escapeText(greeting);
  tb.classList.remove('dialog-hidden');
  tb.setAttribute('data-roam-prompt','greeting');
  tb.setAttribute('data-greeting-char',charId);
  document.querySelectorAll('#portraits .p-slot').forEach(el=>{
    if(el.classList.contains('hidden')) return;
    const active=el.getAttribute('data-char')===charId;
    el.classList.toggle('active',active);
    el.classList.toggle('dim',!active);
  });
  save();
  return true;
}

function ambientText(id){
  const map = {
    nursery: '熟悉的育婴室。床头有纱帐，雕花的天花板。阳光从缝隙漏进来，在被子上投下晃动的光斑。门外是长廊。',
    ownroom: '属于自己的房间。床铺干净整洁，书桌摆放整齐，窗外花园的微风偶尔吹进。从今往后，这里是独属于我的小小天地。',
    hallway: '长廊很长。墙上挂着穿甲胄的男人和华服的女人。窗外能看到庭院，远处有士兵巡逻。两侧有许多门。',
    parlor: '起居室里飘着红茶的香气。',
    garden: '花园的风带着花香。远处有园艺工在修剪。',
    study: '图书室的灰尘在光柱里跳舞。三千册书沉默地等待。',
    dining: '长桌上银器反着光。',
    kitchen: '厨房热气腾腾。点心的甜味让人安心。',
    training: '练武场的沙地被晒得发白。木剑架整齐排列。',
    balcony: '露台上吹着夜风。庭院的灯火像碎金。',
    chapel: '小礼拜堂很静。烛火轻轻摇。',
    cellar: '酒窖阴凉。橡木桶的气息沉甸甸的。',
    secret: '储藏室的墙砖……第三排，似乎有些松动。',
    dorm: '宿舍的床铺整齐。艾玛的布丁罐在桌上。',
    library: '图书馆的角落。靠墙双人桌空着一半。',
    cafeteria: '食堂人声嘈杂。布丁的香气在空气里。',
    clocktower: '钟塔顶层的风很大。视野里是整座学院。',
    flowerhouse: '花坊暖湿。角落里有一盆蓝色的小花。',
    ice_class: '冰系教室空荡荡。窗台上的石质台子很新。',
    memorial: '纪念林的树影婆娑。有一棵小树苗的石牌刻着三个名字。',
    jikan: '霁馆的院子安静。铁锅还在冒热气。',
    northforest: '北林的枯枝在头顶交错。空气里有魔物的气息。',
    auditorium: '大礼堂穹顶高远。长椅排列整齐，讲台上方挂着学院纹章。阳光从彩窗投下斑斓光斑。',
  };
  return map[id] || `（${LOCS[id]?.name||id}）`;
}

// action bar
document.getElementById('action-bar').onclick = e=>{
  const btn = e.target.closest('[data-act]'); if(!btn||!S.freeRoam) return;
  const act = btn.dataset.act; sfx('click');
  if(act==='explore') openMap();
  else if(act==='talk') doTalk();
  else if(act==='train') doTrain();
  else if(act==='study') doStudy();
  else if(act==='course') doCourse();
  else if(act==='rest') doRest();
  else if(act==='item') openPanel('inv');
  else if(act==='encounter'){ if(typeof RelicsAndEvents!=='undefined'&&RelicsAndEvents.openRumorBoard) RelicsAndEvents.openRumorBoard(); }
  else if(act==='next') doNextTime();
};

function openMap(){
  const g=$('map-grid'); g.innerHTML='';
  const phaseLocs = Object.values(LOCS).filter(L=> {
    if(!L.unlock || !phaseAreaAllowed(L.area)) return false;
    // 逃亡（旅途/终章）后：学院与王都材料市场均不可再通过地图前往
    if((S.phase==='journey' || S.phase==='finale') && (L.area==='魔法大学' || L.id==='market')) return false;
    return true;
  });
  phaseLocs.forEach(L=>{
    // 婴儿（<1岁）：无法通过地图离开育婴室（只能点「闹着要出去」）
    if(S.ageY < 1 && L.id !== 'nursery' && L.id !== 'ownroom') return;
    const d=document.createElement('button');
    d.className='map-cell'+(S.loc===L.id?' here':'');
    d.innerHTML=`<span class="mc-icon">${L.icon}</span>${L.name}<div class="mc-cost">${L.area}</div>${L.tags?.includes('egg')&&!S.eggs.includes(L.id)?'<div class="mc-tag">？</div>':''}`;
    d.onclick=()=>{
      if(S.loc===L.id){ toast('已经在这里了'); return; }
      if(S.ageY < 1){ toast('你还太小，不能自己走。让家人抱你出去吧。'); return; }
      show('map-overlay',0);
      enterLoc(L.id);
    };
    g.appendChild(d);
  });
  show('map-overlay',1);
}
$('btn-map-close').onclick=()=>show('map-overlay',0);

// 隐藏/显示全部 UI（沉浸模式）：点按钮隐藏，再点或按 Esc 恢复
function syncUiToggleBtn(hidden){
  const b = $('btn-ui'); if(!b) return;
  const tok = b.querySelector('.sr-icon-token');
  if(tok) tok.textContent = hidden ? '☀️' : '🌙';
  else b.textContent = hidden ? '☀️' : '🌙';
  b.classList.toggle('is-immersive', !!hidden);
}
function uiHide(){
  document.body.classList.add('ui-hidden');
  syncUiToggleBtn(true);
}
function uiShow(){
  document.body.classList.remove('ui-hidden');
  syncUiToggleBtn(false);
  if(S.freeRoam) maybeShowRoamGreeting();
}
function uiToggle(){
  document.body.classList.contains('ui-hidden') ? uiShow() : uiHide();
}
$('btn-ui').onclick=()=>uiToggle();

function whoIsHere(){
  const loc=S.loc, ph=S.phase, tod=S.tod, a=S.ageY;
  const list=[];
  const add=(id)=>{ if(id && !list.includes(id)) list.push(id); };

  // reset season chars at new season
  const seasonKey = S.season;
  if(!S.seasonChars[seasonKey]) S.seasonChars[seasonKey] = {};

  function placeChar(id, possibleLocs){
    if(!id) return;
    let assigned = S.seasonChars[seasonKey][id];
    if(!assigned){
      const avail = possibleLocs.filter(l=>l===loc || true); // filter valid
      assigned = avail[Math.floor(Math.random()*avail.length)] || possibleLocs[0];
      S.seasonChars[seasonKey][id] = assigned;
    }
    if(assigned === loc) add(id);
  }

  if(ph==='prologue'||ph==='childhood'||ph==='youth'){
    if(loc==='nursery' || (loc==='ownroom' && a>=8)){ 
    const room = (loc==='ownroom' && a>=8) ? 'ownroom' : 'nursery';
    placeChar('sophia',[room,'parlor']); if(!flag('ch_beatrice_leaves')) placeChar('beatrice',[room,'parlor','garden']); if(dateAtLeast(2,9)) placeChar('alice',[room,'parlor']); 
  }
    if(loc==='parlor'){ placeChar('sophia',['parlor','nursery','dining']); if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['parlor','garden']); if(dateAtLeast(2,9)) placeChar('alice',['parlor']); if(a>=1) placeChar('claude',['parlor','dining']); }
    if(loc==='dining'){ placeChar('sophia',['dining','parlor']); if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['dining','parlor']); if(dateAtLeast(2,9)) placeChar('alice',['dining']); placeChar('claude',['dining','parlor']); }
    if(loc==='hallway'){ if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['hallway','garden']); if(a>=0) placeChar('sophia',['hallway','parlor']); if(a>=3) placeChar('claude',['hallway']); if(dateAtLeast(2,9)) placeChar('alice',['hallway']); }
    if(loc==='garden'){ if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['garden','hallway']); if(dateAtLeast(2,9)) placeChar('alice',['garden']); if(a>=4) placeChar('sophia',['garden']); }
    if(loc==='study'){ if(a>=1) placeChar('sophia',['study','hallway']); if(dateAtLeast(2,9)) placeChar('alice',['study']); if(a>=5) placeChar('claude',['study']); }
    if(loc==='training'){ if(a>=4 && !flag('ch_beatrice_leaves')) placeChar('beatrice',['training','garden']); if(a>=6) placeChar('claude',['training']); }
    if(loc==='kitchen'){ placeChar('sophia',['kitchen','dining']); if(a>=2) placeChar('beatrice',['kitchen']); }
    if(loc==='balcony'){ if(a>=2) placeChar('beatrice',['balcony','hallway']); if(dateAtLeast(2,9)) placeChar('alice',['balcony']); }
    if(loc==='chapel'){ placeChar('sophia',['chapel','hallway']); if(a>=4) placeChar('claude',['chapel']); }
    if(loc==='cellar'){ if(a>=6) placeChar('claude',['cellar']); }
    if(loc==='town'){ /* random passers */ }
    if(loc==='market' && ph==='academy'){ /* market only accessible from academy */ }
    if(loc==='beach'){ if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['beach','town']); if(dateAtLeast(2,9)) placeChar('alice',['beach']); placeChar('sophia',['beach']); }
  }
  if(ph==='academy'){
    if(loc==='dorm'){ placeChar('emma',['dorm','cafeteria']); if(flag('met_noelle')) placeChar('noelle',['dorm','library']); if(dateAtLeast(14,3)) placeChar('alice',['dorm','cafeteria','library']); }
    if(loc==='library'||loc==='clocktower'){ placeChar('noelle',['library','cafeteria']); if(flag('met_noelle')) placeChar('emma',['library']); if(dateAtLeast(14,3)) placeChar('alice',['library','cafeteria','dorm']); }
    if(loc==='cafeteria'){ placeChar('emma',['cafeteria','dorm']); if(flag('met_noelle')) placeChar('noelle',['cafeteria']); if(flag('met_ajun')) placeChar('ajun',['cafeteria']); if(dateAtLeast(14,3)) placeChar('alice',['cafeteria','dorm','library']); }
    if(loc==='water_class'){ if(flag('met_noelle')) placeChar('noelle',['water_class','library']); placeChar('emma',['water_class']); placeChar('anna',['water_class','cafeteria']); }
    if(loc==='ice_class'||loc==='flowerhouse'){ if(flag('met_aino') && !flag('ch_ice_melt_1')) placeChar('aino',['ice_class','training_field']); placeChar('hol',['ice_class','library']); }
    if(loc==='training_field'){ if(flag('met_aino') && !flag('ch_ice_melt_1')) placeChar('aino',['training_field']); placeChar('beatrice',['training_field']); }
    if(loc==='memorial'){ placeChar('charlotte',['memorial']); if(flag('ch_tree')){ placeChar('beatrice',['memorial']); placeChar('alice',['memorial']); } }
    if(loc==='auditorium'){ placeChar('hol',['auditorium','ice_class']); placeChar('anna',['auditorium','water_class']); }
  }
  if(ph==='journey'||ph==='finale'){
    if(loc==='jikan' && !flag('ch_distant_wind_1')){ placeChar('ji',['jikan']); placeChar('jilan',['jikan']); }
    if(loc==='chenglan_guild'){ placeChar('masha',['chenglan_guild']); }
    if(loc==='northforest'){ /* monsters */ }
    if(loc==='road'){ /* travelers */ }
    if(loc==='ice_canyon' && flag('ch_distant_wind_2')){ placeChar('aino',['ice_canyon']); placeChar('musa',['ice_canyon']); }
  }
  return list;
}

function doTalk(){
  const peeps = whoIsHere();
  if(!peeps.length){
    playLines([{text:'这里暂时没有可以交谈的人。\n换个房间，或到下个时段/季度再来看看。', freeRoam:true}]);
    return;
  }
  // 若只有一人，直接谈
  if(peeps.length===1){ talkTo(peeps[0]); return; }
  const choices = peeps.map(id=>({
    text:`和${CHARS[id]?.short||id}说话`,
    do:()=>talkTo(id)
  }));
  choices.push({text:'还是算了', do:()=>enterFreeRoam()});
  playLines([{text:'要和谁说话？', choices}]);
}

function talkTo(id){
  if(!id || !CHARS[id]){ toast('没有对话对象'); return; }
  let talked = flag('talked_today');
  if(!talked || typeof talked !== 'object') talked = {};
  // 同一人每天前3次都可聊，之后才提示聊够了
  const cnt = talked[id] || 0;
  if(cnt >= 3){
    playLines([{ch:id, text:`（和${CHARS[id].short}暂时没什么新话题了。下个季度再来吧。）`, freeRoam:true}]);
    return;
  }
  if(!spendST(1)){ return; } // 交谈消耗1体力
  talked = Object.assign({}, talked, {[id]: cnt+1});
  flag('talked_today', talked);
  know(id, 2+Math.floor(Math.random()*4));
  // 小幅魅/社交成长
  if(S.stats) S.stats.charm = Math.min(100, (S.stats.charm||0) + 1);
  const lines = talkLines(id);
  if(!lines || !lines.length){
    playLines([{text:`（${CHARS[id].short}看了看你，什么也没说。空气有点微妙。）`, freeRoam:true}]);
    return;
  }
  playLines(lines, ()=>enterFreeRoam());
}

function talkLines(id){
  const a=S.ageY, n=CHARS[id]?.short||id;
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];
  const wrap = (ch, lines) => lines; // already line objects

  const pools = {
    beatrice: a<1 ? [
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:'妹妹！妹妹！看我！——妈妈说要轻一点……那我轻轻的！'}, {text:'她用胖乎乎的手指戳戳我的脸，又怕弄疼，缩了回去。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:'希尔维亚要快点长大！这样我们就能一起玩布偶了！'}, {text:'两岁的姐姐已经在发号施令了。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:'这是我的妹妹！谁都不许抱走！'}, {text:'她张开小小的胳膊挡在床边，理直气壮。', love:'beatrice', loveD:1}],
    ] : [
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:a<6?'希尔维亚！看我转圈——哇！地板好滑！':'听好了！贝阿特丽丝大人今天的训练量翻倍！'}, {text:a<6?'姐姐摔了个屁股墩，又立刻爬起来，笑得没心没肺。':'她说完就去练武场了，木剑带起的风差点掀翻花瓶。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:'妹妹要听姐姐的话！这是维斯特利亚家的规矩！……我刚定的。'}, {text:'理直气壮的样子意外地有说服力。大概只有她信。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:a<10?'火焰兔子！再差一点就成功了！':'论文第三款……希尔维亚你记性好，帮我看看！'}, {text:a<10?'窗帘安全地活过了今天。大概。':'她的桌上铺满草稿，笔帽被咬出牙印。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:'晚上想吃松饼！我去跟厨房说！贝阿特丽丝大人批准了！'}, {text:'她风风火火跑走了。厨房的人大概又要头疼。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:'……希尔维亚。你要是被谁欺负了，告诉我。我罩着你。'}, {text:'语气难得认真。我点点头。', love:'beatrice', loveD:1, know:'beatrice', knowD:2}],
    ],
    alice: a<2 ? [
      [{text:'爱丽丝还太小，只会握住我的手指，眼睛亮亮的。', love:'alice', loveD:1}],
    ] : [
      [{ch:'alice',emo:'normal',speaker:'爱丽丝',text:'……姐姐大人。'}, {ch:'alice',emo:'happy',text:a<5?'……花，开了。':'……今天的风，很软。', love:'alice', loveD:1}],
      [{ch:'alice',emo:'shy',speaker:'爱丽丝',text:'……姐姐大人。可以……坐近一点吗。'}, {text:'她轻轻拉了拉我的袖子。动作轻得像怕惊动什么。', love:'alice', loveD:1, know:'alice', knowD:3}],
      [{ch:'alice',emo:'normal',speaker:'爱丽丝',text:a<8?'……请教我认字。':'……姐姐大人发呆的时候，在想什么？'}, {text:a<8?'她学得很快，快得有点犯规。':'我随口说「大地为什么会拉东西」。她眼睛亮了一下。', love:'alice', loveD:1, know:'alice', knowD:4}],
      [{ch:'alice',emo:'happy',speaker:'爱丽丝',text:'……贝阿特丽丝姐姐又在炫耀了。……不过，我喜欢。'}, {text:'淡淡的语气，内容却意外地有自己的想法。', love:'alice', loveD:1}],
      [{ch:'alice',emo:'shy',speaker:'爱丽丝',text:'……姐姐大人今天也……很好看。'}, {text:'说完就低头。耳尖有一点点红。', love:'alice', loveD:1}],
    ],
    sophia: a<1 ? [
      [{ch:'sophia',emo:'normal',speaker:'索菲亚',text:'我的小宝贝……睡吧，妈妈在。'}, {text:'摇篮曲很轻。世界只剩下心跳和奶香。', love:'sophia', loveD:1}],
      [{ch:'sophia',speaker:'索菲亚',text:'眼睛是蓝的呢……像你父亲。'}, {text:'她用指背碰了碰我的脸颊。'}, {text:'我还不会说话，只能看她。', love:'sophia', loveD:1}],
    ] : [
      [{ch:'sophia',emo:'normal',speaker:'索菲亚',text:a<6?'希尔维亚，有好好吃饭吗？':'希尔维亚，最近有没有太拼命练魔法？'}, {text:'母亲的手拂过我的头发。很轻，很暖。', love:'sophia', loveD:1}],
      [{ch:'sophia',speaker:'索菲亚',text:'院子里的鸢尾开了。你父亲从前很喜欢。……别告诉他我说过。'}, {text:'她笑起来的时候，眼睛弯弯的。', love:'sophia', loveD:1, know:'sophia', knowD:3}],
      [{ch:'sophia',speaker:'索菲亚',text:'三姐妹在一起的时候，家里最吵，也最像家。'}, {text:'我点点头。这句话我想记住。', love:'sophia', loveD:1, if:()=>flag('ch_alice_born')}],
      [{ch:'sophia',speaker:'索菲亚',text:'累了就靠一会儿。母亲还在。'}, {text:'膝枕的高度刚好。我几乎要睡着。', love:'sophia', loveD:1, st:2}],
    ],
    claude: a<1 ? [
      [{ch:'claude',speaker:'克劳德',text:'……手好小。'}, {text:'他的声音放得很低，像怕惊醒整座府邸。大手覆上我的额头，又赶紧收回。', love:'claude', loveD:1}],
    ] : [
      [{ch:'claude',speaker:'克劳德',text:a<8?'希尔维亚。别学你姐姐爬柜子。':'希尔维亚。学业为重。有困难就写信回来。'}, {text:'父亲的话总是很短。但每一句都像钉子一样稳。', love:'claude', loveD:1, know:'claude', knowD:2}],
      [{ch:'claude',speaker:'克劳德',text:'……你的眼睛，像你母亲。'}, {text:'他说完就清了清嗓子，装作去看公文。', love:'claude', loveD:1, know:'claude', knowD:3}],
      [{ch:'claude',speaker:'克劳德',text:'维斯特利亚的名字，不是拿来压人的。是拿来负责的。'}, {text:'我记住了。', love:'claude', loveD:1, know:'claude', knowD:2}],
      [{ch:'claude',speaker:'克劳德',text:'贝阿特丽丝又把花瓶……算了。你帮我看着点她。'}, {text:'公爵大人的太阳穴抽了一下。', love:'claude', loveD:1}],
    ],
    emma: [
      [{ch:'emma',speaker:'艾玛',text:'希尔维亚！！食堂今天的布丁是焦糖味的！！我可以吃你那份吗！'}, {text:'门槛是一份布丁的朋友。很划算。', love:'emma', loveD:1}],
      [{ch:'emma',speaker:'艾玛',text:'你知道吗，我把笔记按颜色分类了！虽然不一定有用，但很好看！'}, {text:'她的书桌像一座甜蜜的灾难现场。', love:'emma', loveD:1}],
      [{ch:'emma',speaker:'艾玛',text:'……其实我有点想家。但有布丁就还好！'}, {text:'她笑得很用力。我把布丁推给她。', love:'emma', loveD:1, know:'emma', knowD:3}],
    ],
    noelle: [
      [{ch:'noelle',speaker:'诺艾儿',text:'……早。今天的笔记我多抄了一份。给你。'}, {text:'她把笔记推过来，自己低头看书。耳尖有点红。', love:'noelle', loveD:1, know:'noelle', knowD:3}],
      [{ch:'noelle',speaker:'诺艾儿',text:'图书馆第三排那本公式推导，第87页印错了。别信。'}, {text:'她说得像在汇报军情。', love:'noelle', loveD:1, know:'noelle', knowD:2}],
      [{ch:'noelle',speaker:'诺艾儿',text:'……虎克来信了。他说想吃王都的糖。'}, {text:'她把信收进怀里，动作很轻。', love:'noelle', loveD:1, know:'noelle', knowD:4}],
      [{ch:'noelle',speaker:'诺艾儿',text:'你的字……还是那么难认。'}, {text:'这大概是她表达关心的方式。', love:'noelle', loveD:1}],
    ],
    aino: (S.loc==='ice_canyon' || flag('ch_distant_wind_2')) ? [
      [{ch:'aino',emo:'serious',speaker:'艾诺',text:'三号药箱的冰膜，今天匀了。'}, {text:'她摘下手套摸过箱沿，只点了点头，没多问一个字。', love:'aino', loveD:1, know:'aino', knowD:2}],
      [{ch:'aino',emo:'normal',speaker:'艾诺',text:'手背的伤，别沾生雪水。医官帐里有新熬的白藓膏。'}, {text:'她说完便转身去查箭垛，银白高马尾在风雪里晃了一下。', love:'aino', loveD:1, know:'aino', knowD:3}],
      [{ch:'aino',emo:'smile',speaker:'艾诺',text:'……伙房今晚有热麦汤。巡完东墙去领，别放凉了。'}, {text:'语气平淡得像在传达军令，却替我挡了一瞬风口吹来的碎雪。', love:'aino', loveD:1, know:'aino', knowD:2}],
      [{if:()=>!!(S.causal && (S.causal.clues?.polar_lily_bond || (S.causal.axes?.aino?.kinship||0)>=2)), ch:'aino',emo:'smile',speaker:'艾诺',text:'……冰膜毫无气泡。这种精细度，北境防线里难得一见。'}, {text:'她没有提起那株名为伊诺的北极铃兰，指尖却在箱沿左下角停了一息。', love:'aino', loveD:1, know:'aino', knowD:3}],
    ] : [
      [{ch:'aino',speaker:'艾诺',text:'你的冰，还有气泡。'}, {text:'她只说这一句。但周六训练场见——这是默认的。', love:'aino', loveD:1, know:'aino', knowD:2}],
      [{ch:'aino',speaker:'艾诺',text:'花坊的水，下午两点换。你若路过，带一壶冷的。'}, {text:'这是在邀请吗？用艾诺语翻译，大概是。', love:'aino', loveD:1, know:'aino', knowD:3}],
      [{ch:'aino',speaker:'艾诺',text:'……赫兰的雪，比这里像样。'}, {text:'她看着窗外，声音很轻。', love:'aino', loveD:1, know:'aino', knowD:2}],
    ],
    charlotte: [
      [{ch:'charlotte',speaker:'夏洛特',text:'维斯特利亚。你浇水又浇多了。'}, {text:'她在照顾那棵旧树。木牌上的字被重新刻过。', know:'charlotte', knowD:3, love:'charlotte', loveD:1}],
      [{ch:'charlotte',speaker:'夏洛特',text:'……别用那种眼神看我。我只是不想树死了碍眼。'}, {text:'嘴硬得像冰。', know:'charlotte', knowD:2, love:'charlotte', loveD:1}],
      [{ch:'charlotte',speaker:'夏洛特',text:'你姐姐的嗓门，全校都能听见。这是噪音污染。'}, {text:'她扇子一合， indignant 得很精致。', love:'charlotte', loveD:1}],
    ],
    ajun: [
      [{ch:'ajun',speaker:'阿琼',text:'希尔维亚！！要不要吃咖喱！！不辣的版本！！'}, {text:'他的热情大概来自巴依的阳光。', love:'ajun', loveD:1}],
      [{ch:'ajun',speaker:'阿琼',text:'地图！我这次没拿反！……大概。'}, {text:'他背后的路牌指向相反方向。', love:'ajun', loveD:1}],
      [{ch:'ajun',speaker:'阿琼',text:'沙之花给你看！——啊散了。再来一次！'}, {text:'金沙在掌心亮了一下，像短暂的夏天。', love:'ajun', loveD:1, know:'ajun', knowD:2}],
    ],
    helena: [
      [{ch:'helena',speaker:'海伦娜',text:'希尔维亚！今天的云看起来像羊！你看你看！'}, {text:'她自带一盏灯。连吐槽都亮堂。', love:'helena', loveD:1}],
      [{ch:'helena',speaker:'海伦娜',text:'要写信哦！我会画很多笑脸！'}, {text:'按这个增速，年底信纸一半都是笑脸。', love:'helena', loveD:1, know:'helena', knowD:2}],
    ],
    hol: [
      [{ch:'hol',speaker:'霍尔',text:'……嗯。下课。……还有十分钟？那就自习。'}, {text:'他翻了一页杂志。封面是《赫兰温泉指南》。', love:'hol', loveD:1}],
      [{ch:'hol',speaker:'霍尔',text:'你的冰球，气泡少了。继续。……别打扰我，这一章很重要。'}, {text:'他看的书和冰系教学毫无关系。', love:'hol', loveD:1, know:'hol', knowD:3}],
      [{ch:'hol',speaker:'霍尔',text:'……窗台上的花快开了。你的冰膜刚好。'}, {text:'他嘴上说着不在意，但窗台上的花浇得比谁都勤。', love:'hol', loveD:1, know:'hol', knowD:4}],
    ],
    anna: [
      [{ch:'anna',speaker:'安娜',text:'希尔维亚同学，水膜的控制很稳定！不过实战中可以再大胆一些，别怕犯错。'}, {text:'她说话语速很快，但每个字都很清楚。', love:'anna', loveD:1}],
      [{ch:'anna',speaker:'安娜',text:'有什么不懂的随时来问我。我办公室在二楼，门从来不关。'}, {text:'她笑起来的时候，眼睛会弯成月牙。', love:'anna', loveD:1, know:'anna', knowD:3}],
      [{ch:'anna',speaker:'安娜',text:'你的水球术很有天赋。但记住，水不只是攻击——它也可以是保护。'}, {text:'她说这话的时候，语调格外认真。', love:'anna', loveD:1, know:'anna', knowD:4}],
    ],
    fashen: [
      [{ch:'fashen',speaker:'法神',text:'……维斯特利亚。你的成绩不错。但不要以为这样就够了。'}, {text:'她的气场压得人几乎站不直。', love:'fashen', loveD:1, know:'fashen', knowD:5}],
      [{ch:'fashen',speaker:'法神',text:'你叔叔欠我钱。下次见面替我催他。'}, {text:'……原来这就是神级强者的日常吗。', love:'fashen', loveD:1, know:'fashen', knowD:3}],
    ],
    ji: [
      [{ch:'ji',speaker:'霁馆主',text:'来都来了——练三组步法？还是先吃饭？今天的粥没糊。大概。'}, {text:'他说「大概」的时候我选择了练剑。', love:'ji', loveD:1}],
      [{ch:'ji',speaker:'霁馆主',text:'剑不是锤子。你在拧毛巾。再松。'}, {text:'我松了。竹剑轻了半两。', love:'ji', loveD:1, know:'ji', knowD:2}],
      [{ch:'ji',speaker:'霁馆主',text:'……这把剑跟了我三十年。你若走远路，带着。'}, {text:'他笑纹很深。像年轮。', love:'ji', loveD:1, know:'ji', knowD:3}],
    ],
    jilan: [
      [{ch:'jilan',speaker:'霁岚',text:'你回来啦！北林怎么样？——啊你胳膊又挂彩了，我帮你上药！'}, {text:'她的力道依旧工业级。', love:'jilan', loveD:1}],
      [{ch:'jilan',speaker:'霁岚',text:'紫蝴蝶！今天也在！好看吧！我自己买的！'}, {text:'和她褪色的练功服形成奇妙对比。', love:'jilan', loveD:1}],
      [{ch:'jilan',speaker:'霁岚',text:'……其实我希望更多人来学剑。馆里太安静了。'}, {text:'她笑着说，眼神却飘向空房间的门牌钉孔。', love:'jilan', loveD:1, know:'jilan', knowD:3}],
    ],
    reno: [
      [{ch:'reno',speaker:'雷纳德',text:'哟，小怪物。魔法大学还没把你开除吧？'}, {text:'叔叔懒洋洋地靠着门框，靴子上又是泥。', love:'reno', loveD:1}],
      [{ch:'reno',speaker:'雷纳德',text:'北方的雪狼像滚动的雪球。真的。骗你是小狗。'}, {text:'他比划的长度越来越离谱。', love:'reno', loveD:1, know:'reno', knowD:2}],
    ],
    yaoshen: [
      [{ch:'yaoshen',speaker:'药神',text:'小公主还好吗？药瓶可别打开哦。'}, {text:'他笑起来皱纹堆在一起，像一枚温热的章。', love:'yaoshen', loveD:1}],
    ],
    huke: [
      [{ch:'huke',speaker:'虎克',text:'银色头发的姐姐！我记住你了！我以后也要考魔法大学！'}, {text:'他挺起小小的胸膛。像一只认真的雀。', love:'huke', loveD:1}],
    ],
    masha: [
      [{ch:'masha',speaker:'玛莎',text:'北林深处最近不太平，看见带霜脊的影豺脚印就赶紧撤，别硬撑。'}, {text:'她啪嗒啪嗒拨着算盘，头也不抬地叮嘱了一句。', know:'masha', knowD:3}],
      [{ch:'masha',speaker:'玛莎',text:'你交上来的魔核切口倒是利索，一点没碎，省了我不少核验工夫。'}, {text:'她麻利地数出几枚银币推过柜台。', know:'masha', knowD:3}],
      [{ch:'masha',speaker:'玛莎',text:'霁馆那爷俩人不错，就是霁馆主做饭的动静，隔着两条街都能闻见糊味。'}, {text:'玛莎摇着头笑了一声，在登记册上打了个勾。', know:'masha', knowD:2}],
    ],
    musa: [
      [{ch:'musa',speaker:'穆萨',text:'渔姑娘来得正好！这批刚采来的北境白藓最怕冻过头，劳烦再给箱沿覆一层薄冰膜！'}, {text:'老药师搓着冻红的手，眼角笑出细密的褶子。', love:'musa', loveD:1, know:'musa', knowD:3}],
      [{ch:'musa',speaker:'穆萨',text:'防卫队的小伙子们嘴上不说，其实都在念叨那晚尾车边稳如磐石的冰剑护卫呢。'}, {text:'他顺手往我手里塞了小半袋晒干的温脾果脯。', love:'musa', loveD:1, know:'musa', knowD:3}],
      [{ch:'musa',speaker:'穆萨',text:'听说东崖哨卡的巡逻兵昨晚又瞧见雪狼群影，巡墙时记得护好手背旧伤呀。'}, {text:'药帐里飘出苦甘交织的草木气，让人莫名踏实。', know:'musa', knowD:2}],
    ],
    lein: [
      [{ch:'lein',speaker:'莱恩',text:'哟，渔！走商这阵子我可摸熟了好几家便宜又干净的驿站——师父说我总算不至于迷路了！'}, {text:'他笑得眉眼舒展，指间不知何时又折好一只草叶小船。', love:'lein', loveD:1, know:'lein', knowD:3}],
      [{ch:'lein',speaker:'莱恩',text:'水壶带够了吗？北边风干，喝一口冷水比什么都管用！'}, {text:'还是那个习惯先递水的爽朗学徒。', love:'lein', loveD:1, know:'lein', knowD:2}],
    ],
    peilin: [
      [{ch:'peilin',speaker:'沛霖',text:'茶凉了再续。出门在外，账算明白，路走稳当，比什么豪言壮语都靠得住。'}, {text:'他端着粗瓷茶盏，眉目沉稳得仿佛四周风雪都慢了半拍。', love:'peilin', loveD:1, know:'peilin', knowD:3}],
      [{ch:'peilin',speaker:'沛霖',text:'莱恩那小子走南闯北话多，心肠倒是实诚。若到了北风堡有难处，报沛记药行的名号便好。'}, {text:'说完他又恢复那副淡然谈价的商贾神色，像只随口提了句天气。', love:'peilin', loveD:1, know:'peilin', knowD:3}],
    ],
  };

  const pool = pools[id];
  if(pool && pool.length){
    // 过滤掉首行带 if 条件且当前不满足的对话组（如"三姐妹"需爱丽丝出生后才可聊）
    const eligible = pool.filter(g=> !(g[0] && typeof g[0].if === 'function') || g[0].if());
    const source = (eligible && eligible.length) ? eligible : pool;
    const lines = pick(source).map(L=>{
      // deep copy plain objects
      return Object.assign({}, L);
    });
    return lines;
  }
  return [{text:`和${n}聊了一会儿。风从窗外进来，把话尾吹散了。`, know:id, knowD:2}];
}


// ========== 养成四维 & 课程体系 ==========
const STAT_LABEL = {body:'体能', mind:'心智', mana:'魔力适性', charm:'气质'};
const COURSES = {
  // 家庭
  home_letters:{id:'home_letters', name:'识字与礼仪', phase:['childhood','youth'], teacher:'家庭教师', needAge:1,
    stat:{mind:2, charm:1}, st:2, desc:'字母、贵族礼仪与基础算术。', skillAt:3, skill:{id:'etiquette', name:'贵族仪态', type:'passive', desc:'交涉与正式场合检定小幅提升。'}},
  home_mana:{id:'home_mana', name:'魔力导引', phase:['childhood','youth'], teacher:'自学/藏书', needAge:3, needFlag:'mana_awakened',
    stat:{mana:3, mind:1}, st:3, desc:'冥想、水球与冰晶塑形。', skillAt:2, skill:{id:'water_ball', name:'水球术', type:'active', desc:'凝聚水球进行攻击或取物。'}},
  home_sword:{id:'home_sword', name:'剑术启蒙', phase:['youth'], teacher:'剑术教官', needAge:5,
    stat:{body:3}, st:3, desc:'木剑基本架势与步法。', skillAt:3, skill:{id:'basic_guard', name:'基本防御架', type:'passive', desc:'物抗小幅提升。'}},
  // 学院
  uni_theory:{id:'uni_theory', name:'魔法理论', phase:['academy'], teacher:'通识教授', needAge:12,
    stat:{mind:3, mana:1}, st:2, desc:'梅林定律、阻率与构造。', skillAt:2, skill:{id:'theory_note', name:'理论笔记', type:'passive', desc:'学习类收益+10%。'}},
  uni_water:{id:'uni_water', name:'水系实操', phase:['academy'], teacher:'安娜·贝尔', needAge:12,
    stat:{mana:3, body:1}, st:3, desc:'控制、塑形与防御水膜。', skillAt:2, skill:{id:'water_veil_s', name:'水膜', type:'active', desc:'短时水膜防御。'}},
  uni_ice:{id:'uni_ice', name:'冰系精修', phase:['academy'], teacher:'霍尔', needAge:12,
    stat:{mana:4}, st:3, desc:'球形凝冰、冰墙生根。', skillAt:2, skill:{id:'ice_sphere', name:'完美冰球', type:'passive', desc:'冰系塑形稳定性提升。'}},
  // 霁馆（离开澄岚前）
  dojo_foot:{id:'dojo_foot', name:'步法', phase:['journey'], teacher:'霁馆主', needAge:13, forbidFlag:'ch_distant_wind_1',
    stat:{body:4}, st:3, desc:'生根、横移、走着砍。', skillAt:2, skill:{id:'root_step', name:'生根步', type:'passive', desc:'被击退距离减少。'}},
  dojo_blade:{id:'dojo_blade', name:'挥剑', phase:['journey'], teacher:'霁馆主', needAge:13, forbidFlag:'ch_distant_wind_1',
    stat:{body:3, mana:1}, st:3, desc:'不用力的送刀，剑是活的。', skillAt:2, skill:{id:'soft_cut', name:'送刀', type:'active', desc:'低耗刀势，附带少量魔力。'}},
  // 北行与赫兰前线（离开霁馆后）
  border_blade:{id:'border_blade', name:'覆冰剑技', phase:['journey','finale'], teacher:'自修·实战', needAge:15, needFlag:'ch_distant_wind_1',
    stat:{body:3, mana:2}, st:3, desc:'将极薄钢冰贴合乌木铁刃，锤炼拔剑与收力。', skillAt:2, skill:{id:'frost_edge', name:'覆冰锋', type:'passive', desc:'剑刃覆薄冰，近战衔接更敏锐。'}},
  helan_tactics:{id:'helan_tactics', name:'冻土防务', phase:['journey','finale'], teacher:'艾诺', needAge:15, needFlag:'ch_distant_wind_2',
    stat:{mana:3, mind:2}, st:3, desc:'与机动防卫队演练窄道控场与不经手凝冰。', skillAt:2, skill:{id:'instant_ice', name:'隔空凝冰', type:'active', desc:'跳过手部节点直接凝冰截击，高概率冰冻。'}},
};

function addStat(k, v){
  if(!S.stats) S.stats = {body:5, mind:15, mana:10, charm:8};
  S.stats[k] = Math.min(100, Math.max(0, (S.stats[k]|0) + v));
}
function courseProgress(id, exp){
  if(!S.courses) S.courses = {};
  const c = COURSES[id]; if(!c) return;
  const st = S.courses[id] || {lv:0, exp:0};
  st.exp += exp;
  while(st.exp >= 10 + st.lv*5){
    st.exp -= 10 + st.lv*5;
    st.lv++;
    toast(`📚 ${c.name} Lv.${st.lv}`);
    if(c.skill && st.lv >= (c.skillAt||3) && !hasSkill(c.skill.id) && !(S.skillsLearned||[]).includes(c.skill.id)){
      addSkill(c.skill.id);
      S.skillsLearned = S.skillsLearned || [];
      S.skillsLearned.push(c.skill.id);
      sysPopup('✨ 学会技能', `「${c.skill.name}」<br>${c.skill.desc}`);
    }
  }
  S.courses[id] = st;
}
function availableCourses(){
  return Object.values(COURSES).filter(c=>{
    if(c.needAge!=null && S.ageY < c.needAge) return false;
    if(c.needFlag && !flag(c.needFlag)) return false;
    if(c.forbidFlag && flag(c.forbidFlag)) return false;
    if(c.id.startsWith('dojo_') && (flag('ch_distant_wind_2') || S.loc==='ice_canyon')) return false;
    if(c.phase && !c.phase.includes(S.phase) && !(S.phase==='youth' && c.phase.includes('childhood'))) return false;
    // phase map
    const ph = S.phase;
    if(ph==='prologue' || ph==='childhood') return c.phase.includes('childhood') || c.phase.includes('youth');
    if(ph==='youth') return c.phase.includes('youth') || c.phase.includes('childhood');
    if(ph==='academy') return c.phase.includes('academy');
    if(ph==='journey' || ph==='finale') return c.phase.includes('journey');
    return true;
  });
}
function doCourse(){
  const list = availableCourses();
  if(!list.length){
    playLines([{text:'目前没有可上的课程。随着年龄与阶段推进会解锁。', freeRoam:true}]);
    return;
  }
  const choices = list.map(c=>({
    text:`${c.name}（${c.teacher}）⚡${c.st||2}`,
    do:()=>takeCourse(c.id)
  }));
  choices.push({text:'取消', do:()=>enterFreeRoam()});
  playLines([{text:'要上哪一门课？', choices}]);
}
function courseTeacherCharId(teacherName){
  const map = {
    '家庭教师':'teacher', '自学/藏书':null, '剑术教官':null,
    '通识教授':null, '安娜·贝尔':'anna', '霍尔':'hol',
    '霁馆主':'ji', '艾诺':'aino', '自修·实战':null,
  };
  return map[teacherName] || null;
}

function takeCourse(id){
  const c = COURSES[id]; if(!c) return;
  if(!spendST(c.st||2)) return;
  // apply stats
  const parts = [];
  Object.entries(c.stat||{}).forEach(([k,v])=>{ addStat(k,v); parts.push(`${STAT_LABEL[k]}+${v}`); });
  courseProgress(id, 5 + Math.floor((S.stats.mind||0)/20));
  addExp(8 + (S.stats.mind||0)/10);
  const lv = S.courses[id]?.lv || 0;
  // map teacher name to character id for portrait
  const teacherCharId = courseTeacherCharId(c.teacher);
  const lines = [];
  if(teacherCharId){
    lines.push({ch:teacherCharId, speaker:c.teacher, text:`【课程】${c.name}\n${c.desc}`});
  } else {
    lines.push({text:`【课程】${c.name}\n指导：${c.teacher}\n${c.desc}`});
  }
  lines.push({text:`练习结束。${parts.join('，')}。\n课程等级 Lv.${lv}。体力-${c.st||2}。`, freeRoam:true});
  playLines(lines);
  updateHUD();
}


function doTrain(){
  const L=LOCS[S.loc];
  if(!L.tags?.includes('train') && S.loc!=='garden' && S.loc!=='training' && S.loc!=='training_field' && S.loc!=='ice_class' && S.loc!=='northforest' && S.loc!=='jikan'){
    playLines([{text:'这里不适合修行。去花园、练武场或训练场吧。', freeRoam:true}]); return;
  }
  if(!spendST(3)) return;
  if(S.sickUntil > S.dayCount){
    playLines([{text:'你还在生病状态中，是否继续修行？', choices:[
      {text:'继续（触发生病剧情）', do:()=>{ triggerSickPlot(); }},
      {text:'取消', do:()=>enterFreeRoam()}
    ]}]);
    return;
  }
  const lines = [{text:'开始修行……'}];
  if(S.affinity.includes('ice')||S.affinity.includes('water')){
    lines.push({text:'将魔力引导至掌心。冰晶缓缓凝结。', sfx:'magic', mp:-5, exp:15+S.tier*5});
    if(!flag('mana_awakened') && S.ageY>=3){
      lines.push({text:'——身体里有什么在流动。', flag:'mana_awakened', task:'mana_sense', ach:'lazy_genius'});
      lines.push({text:'系统发出提示音。经验值上涨。'});
      lines.push({do:()=>{ addExp(100); checkTierUp(); }});
    }
    if(S.loc==='northforest'){
      lines.push({text:'顺便清理了附近的魔物。', exp:40, gold:5});
    }
    if(S.loc==='ice_canyon'){
      lines.push({text:'顶着峡谷风口演练覆冰斩击与隔空凝冰，顺手清除了逼近外哨的冻土魔物。', exp:55, gold:8});
      S.atk += 0.15;
    }
    if(S.loc==='jikan' || S.loc==='training'){
      lines.push({text:'竹剑的手感沉了些。身体记得住。', exp:20});
      S.atk += 0.1; // accumulates
    }
  }
  if(S.stats){ addStat('mana', 1); addStat('body', S.loc==='training'||S.loc==='jikan'||S.loc==='training_field'||S.loc==='ice_canyon'?2:1); }
  lines.push({text:`修行结束。魔力适性与体能略有提升。\n体力-3。当前 ${S.st}/${S.mst}。`, freeRoam:true});
  playLines(lines);
}

function triggerSickPlot(){
  S.sickUntil = (S.dayCount || 0) + 365; // one year
  S.mst = Math.max(3, (S.mst||5) - 1);
  S.st = Math.min(S.st, S.mst);
  playLines([
    {text:'你强行继续修行，魔力逆流，身体出现异常。'},
    {text:'一年内体力上限减少1点。', do:()=>{ S.st = Math.min(S.st, S.mst); }},
    {text:'（生病剧情已触发）', freeRoam:true}
  ]);
}

function doStudy(){
  const L=LOCS[S.loc];
  if(!L.tags?.includes('study') && S.loc!=='study' && S.loc!=='library' && S.loc!=='clocktower'){
    playLines([{text:'这里没有可看的书。去图书室或图书馆吧。', freeRoam:true}]); return;
  }
  if(!spendST(2)) return;
  const bonus = hasSkill('deep_read')||hasSkill('ice_palace') ? 10 : 0;
  if(S.stats) addStat('mind', 2);
  playLines([
    {text:'翻开书页。这个世界的魔法理论其实相当自洽。'},
    {text:'梅林三大定律、亲和与赋亲和、魔导阻率……', exp:20+bonus, mp:5},
    {text: (hasSkill('ice_palace') ? '（将这一页冻结进冰晶宫殿。）' : '记下要点。') + ' 心智+2。', freeRoam:true}
  ]);
  // chance to raise know of magic topics
  if(S.loc==='library' && whoIsHere().includes('noelle')){
    know('noelle', 2);
  }
}

function doRest(){
  if(!spendST(0)) {}
  if(S.restThisSeason >= 1){
    playLines([{text:'本季度已经休息过一次了。', freeRoam:true}]);
    return;
  }
  const isBed = LOCS[S.loc]?.tags?.includes('rest') || S.loc==='nursery'||S.loc==='dorm'||S.loc==='jikan' || S.loc==='ownroom';
  S.restThisSeason = 1;
  const stRecover = Math.floor(S.mst / 3);
  playLines([
    {text: isBed ? '躺到床上。闭上眼睛。' : '找了个角落靠着。眼皮很重。'},
    {do:()=>{
      const bonus = hasSkill('quiet_mind') ? 10 : 0;
      S.hp=S.mhp; S.mp=clamp(S.mp+Math.floor(S.mmp*0.5)+bonus,0,S.mmp);
      S.st = clamp(S.st + stRecover, 0, S.mst);
      // dream duel opportunity
      maybeDreamDuel();
    }},
    {text:`休息片刻。体力恢复${stRecover}点。`, freeRoam:true}
  ]);
}

function doNextTime(){
  // default: open season menu via override
  advanceSeason(1);
  if(checkStoryGates()) return;
  playLines([{text:`时间来到 ${dateStr()}。`, freeRoam:true}]);
}

function maybeDreamDuel(){
  if(!hasSkill('virtual_duel')) return;
  const candidates = Object.keys(S.know).filter(id=> (S.know[id]||0)>=90 && !S.duelWins.includes(id+'_cur'));
  if(!candidates.length) return;
  // auto prompt
  flag('dream_duel_ready', candidates[0]);
}

// ========== EGGS ==========
function tryLocEgg(locId){
  if(S.eggs.includes(locId)) return false;
  const eggs = {
    garden:()=>{
      if(S.ageY<1) return;
      S.eggs.push('garden'); ach('egg_garden');
      playLines([
        {text:'花坛角落有什么在闪光。'},
        {text:'一枚小小的冰蓝色石子。握在手心微微发凉。', item:{id:'ice_pebble', name:'冰蓝石子', icon:'💎', desc:'花园里捡到的。会微微发凉。'}, freeRoam:true}
      ]);
    },
    study:()=>{
      if(S.ageY<4) return;
      S.eggs.push('study');
      playLines([
        {text:'书架最上层夹着一封旧信。发件人……春日悠？'},
        {text:'内容是关于「赋亲和可变性」的讨论。夹页里还有另一个人的笔迹——更娟秀。像是女性。', flag:'clue_kasuga', freeRoam:true}
      ]);
    },
    cellar:()=>{
      if(S.ageY<6 || !flag('explored_cellar')) { flag('explored_cellar',1); }
      S.eggs.push('cellar'); ach('egg_cellar');
      playLines([
        {text:'最深处的桶架后面，刻着一行小字。'},
        {text:'「谈比打好。——初代」', freeRoam:true}
      ]);
    },
    chapel:()=>{
      S.eggs.push('chapel');
      playLines([
        {text:'礼拜堂的彩窗在下午会投下一小块蓝光。刚好落在第二排座位。'},
        {text:'母亲说，那是她小时候最喜欢坐的位置。', love:'sophia', loveD:1, freeRoam:true}
      ]);
    },
    balcony:()=>{
      S.eggs.push('balcony');
      playLines([
        {text:'露台栏杆下压着一张折起来的纸——姐姐的字：'},
        {text:'「贝阿特丽丝大人的秘密基地！禁止妹妹发现！——写完发现没法禁止，算了。」', love:'beatrice', loveD:1, freeRoam:true}
      ]);
    },
    kitchen:()=>{
      S.eggs.push('kitchen');
      playLines([
        {text:'厨师偷偷塞给我一块还热乎的小饼干。'},
        {text:'「大小姐别告诉夫人，饭前吃点心要挨骂的。」', item:{id:'cookie', name:'热饼干', icon:'🍪', desc:'饭前偷吃专用。'}, freeRoam:true}
      ]);
    },
    secret:()=>{
      if(S.phase!=='finale' && !flag('can_secret')) {
        playLines([{text:'墙砖有些松。但现在还不是动它的时候。', freeRoam:true}]); return;
      }
      S.eggs.push('secret');
      playLines([{text:'密道的入口。石阶向下，通向未知。', freeRoam:true}]);
    },
    clocktower:()=>{
      S.eggs.push('clocktower'); ach('egg_clock'); doneTask('clock_tower');
      playLines([
        {text:'钟塔顶层。风从四面灌进来，视野里整座学院一览无余——尖塔、花坊、训练场，都安静地铺在脚下。我第一次登顶，掏出本子记了记景观。'},
        {text:'角落的长椅下蜷着一只橘猫。诺艾儿正蹲在几步外，往地上放了点吃的。'},
        {ch:'noelle',speaker:'诺艾儿',text:'……它不亲人。但喂熟了就会来。'},
        {text:'橘猫犹豫了一下，慢悠悠地凑过去吃了。', love:'noelle', loveD:1, freeRoam:true}
      ]);
    },
    flowerhouse:()=>{
      // 艾诺离开（冰融之际·上 13年秋）后，花坊初到事件不再触发
      if(flag('ch_ice_melt_1')) return;
      S.eggs.push('flowerhouse');
      playLines([
        {ch:'aino',speaker:'艾诺',text:'……它叫伊诺。冬天的孩子。'},
        {text:'北极铃兰在冰雾里微微颤动。', love:'aino', loveD:1, know:'aino', knowD:8, freeRoam:true}
      ]);
    },
    memorial:()=>{
      S.eggs.push('memorial');
      playLines([
        {text:'旧木牌上补刻的字：——mond。'},
        {ch:'charlotte',speaker:'夏洛特',text:'别谢我。怕你把树养死了碍眼。'},
        {text:'她把木牌转了个角度。', know:'charlotte', knowD:10, love:'charlotte', loveD:1, freeRoam:true}
      ]);
    },
    market:()=>{
      if(flag('met_huke')) return;
      const noelleLove = S.love.noelle || 0;
      if(noelleLove < 2){ 
        playLines([{text:'（需要诺艾儿好感度达到2以上才能触发材料市场剧情）', freeRoam:true}]);
        return;
      }
      S.eggs.push('market');
      doneTask('market_walk');
      runScene('s_huke');
    },
  };
  if(!eggs[locId]) return false;
  const before = S.eggs.length;
  const beforeScene = currentScene;
  eggs[locId]();
  // if egg fired scene or added egg id, it handled UI
  if(S.eggs.length > before || currentScene !== beforeScene || typing || lineCB || awaitingChoice) return true;
  return false;
}

// ========== BRAVE GIFT ==========
function pickSigilSVG(id, isStar, idx){
  if(id === 'ice_palace'){
    return `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.45"><polygon points="24,4 39,14 39,34 24,44 9,34 9,14"/><polygon points="24,10 33,24 24,38 15,24" stroke-width="1.15" fill="currentColor" fill-opacity="0.14"/><circle cx="24" cy="24" r="2.8" fill="currentColor"/><line x1="24" y1="4" x2="24" y2="10"/><line x1="24" y1="38" x2="24" y2="44"/><line x1="9" y1="24" x2="15" y2="24"/><line x1="33" y1="24" x2="39" y2="24"/></svg>`;
  }
  if(id === 'mana_cycle'){
    return `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="24" cy="24" r="17" stroke-dasharray="5 3"/><circle cx="24" cy="24" r="11"/><path d="M24 7 L28 13 L20 13 Z" fill="currentColor"/><path d="M24 41 L20 35 L28 35 Z" fill="currentColor"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>`;
  }
  if(id === 'virtual_duel'){
    return `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="24" cy="24" r="16"/><line x1="12" y1="36" x2="36" y2="12"/><line x1="12" y1="12" x2="36" y2="36"/><polygon points="24,8 27,24 24,40 21,24" fill="currentColor" opacity="0.28"/></svg>`;
  }
  if(isStar){
    return `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.4"><polygon points="24,5 28.5,19.5 43,24 28.5,28.5 24,43 19.5,28.5 5,24 19.5,19.5" fill="currentColor" fill-opacity="0.14"/><circle cx="24" cy="24" r="7"/></svg>`;
  }
  const variants = [
    `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.35"><polygon points="24,7 39,24 24,41 9,24"/><polygon points="24,14 32,24 24,34 16,24" opacity="0.72"/><circle cx="24" cy="24" r="2.2" fill="currentColor"/></svg>`,
    `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.35"><polygon points="24,6 38,14 38,34 24,42 10,34 10,14"/><line x1="24" y1="6" x2="24" y2="42" opacity="0.5"/><line x1="10" y1="14" x2="38" y2="34" opacity="0.5"/><line x1="38" y1="14" x2="10" y2="34" opacity="0.5"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>`,
    `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.35"><circle cx="24" cy="24" r="16" stroke-dasharray="4 3"/><polygon points="24,9 36,33 12,33"/><circle cx="24" cy="25" r="3" fill="currentColor"/></svg>`,
    `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.35"><rect x="12" y="12" width="24" height="24" transform="rotate(45 24 24)"/><rect x="13" y="13" width="22" height="22" opacity="0.6"/><circle cx="24" cy="24" r="3" fill="currentColor"/></svg>`,
    `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.35"><circle cx="24" cy="24" r="15"/><path d="M12 24h24M24 12v24" opacity="0.55"/><polygon points="24,13 29,24 24,35 19,24" fill="currentColor" fill-opacity="0.2"/></svg>`,
    `<svg viewBox="0 0 48 48" width="42" height="42" fill="none" stroke="currentColor" stroke-width="1.35"><polygon points="24,6 31,18 42,24 31,30 24,42 17,30 6,24 17,18"/><circle cx="24" cy="24" r="4.5"/></svg>`,
  ];
  return variants[(Number(idx) || 0) % variants.length];
}
function triggerBraveGift(tier){
  if(S.picksDone.includes(tier)) return;
  S.tier = Math.max(S.tier, tier);
  pendingPicks = tier;
  // build 7 cards: for tier 0 guarantee virtual_duel as star; tier1 ice_palace; tier2 mana_cycle
  const pool = Object.values(ALL_PICKS).filter(p=>p.tier===tier || (tier>2 && p.tier===2));
  let picks = pool.slice(0,7);
  while(picks.length<7){
    picks.push({id:'filler_'+picks.length, name:'寻常之技·'+picks.length, tier, tag:'普通', desc:'一项平平无奇的强化。', filler:true});
  }
  // sort star first
  const star = tier===0?'virtual_duel':tier===1?'ice_palace':tier===2?'mana_cycle':null;
  if(star){ picks = picks.filter(p=>p.id!==star); const s=ALL_PICKS[star]; if(s) picks.unshift(s); }
  picks = picks.slice(0,7);
  setBG('bg-pick'); bgmPlayType('sacred', {force:true});
  show('pick-screen',1); show('game-screen',1);
  const g=$('pick-grid'); g.innerHTML='';
  const romans = ['I','II','III','IV','V','VI','VII'];
  picks.forEach((p, idx)=>{
    const isStar = !!(star && p.id === star);
    const d=document.createElement('div');
    d.className='pick-card' + (isStar ? ' pick-star' : '');
    d.innerHTML=`
      <div class="pick-roman">${romans[idx] || (idx+1)}</div>
      ${isStar ? '<span class="pick-star-seal" title="天命星印">✦ 启示</span>' : ''}
      <div class="pick-sigil" aria-hidden="true">${pickSigilSVG(p.id, isStar, idx)}</div>
      <div class="tag">${p.tag||'赋技能'}</div>
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="pick-foot">✦ 铭刻此赐</div>
    `;
    d.onclick=()=>selectPick(p, tier);
    g.appendChild(d);
  });
  sfx('magic');
  updateHUD();
}
function selectPick(p, tier){
  if(!S.picksDone.includes(tier)) S.picksDone.push(tier);
  S.tier = Math.max(S.tier, tier);
  if(!p.filler){
    addSkill(p.id);
    if(p.id==='virtual_duel') ach('virtual_first');
    if(p.id==='ice_palace') ach('ice_palace_on');
  }
  show('pick-screen', 0);
  bgmRestoreScene(); // 选卡结束恢复场景 bgm
  sfx('level');
  updateHUD(); save();
  const ap = afterPick; afterPick = null;
  if(ap && ap.rest && ap.rest.length){
    // 剧情场景中的选卡：弹出习得面板，然后接着往下演
    sysPopup('✧ 勇者之赐 ✧', `✨ 你选择了：<b>${p.name}</b>（${p.tag||'赋技能'}）<br><br>技能已习得！<br><span style="opacity:.75">${p.desc||''}</span>`);
    playLines(ap.rest, ap.done);
    return;
  }
  playLines([
    {text:`时间恢复流动。\n你获得了「${p.name}」。\n${p.desc}`},
    {text:'（可以继续行动了。）', freeRoam:true}
  ]);
}

// ========== BATTLE (simple) ==========
// ========== BATTLE (回合制策略战斗) ==========
// —— 元素克制环：火克冰、冰克风、风克土、土克水、水克火；光↔暗互相克制 ——
const ELEM_CHART = { fire:'ice', ice:'wind', wind:'earth', earth:'water', water:'fire', light:'dark', dark:'light' };
const ELEM_NAME = { fire:'火', ice:'冰', wind:'风', earth:'土', water:'水', light:'光', dark:'暗', phys:'物理' };
function elemMult(atkElem, defElem){
  if(!atkElem || atkElem==='phys' || !defElem || defElem==='phys') return 1;
  if(ELEM_CHART[atkElem]===defElem) return 1.5;   // 克制
  if(ELEM_CHART[defElem]===atkElem) return 0.75;  // 被克
  return 1;
}

// —— 主动战斗技能库（玩家通过课程/勇者之赐/决斗/剧情获得并装配）——
// power 为攻击系数（×魔攻/物攻）；ap 行动点；mp 魔力；effect 为状态效果
const COMBAT_SKILLS = {
  attack:{name:'攻击', elem:'phys', ap:1, mp:0, power:1.0, atkKind:'atk', desc:'朴实无华的一击。'},
  water_ball:{name:'水球术', elem:'water', ap:1, mp:4, power:1.25, atkKind:'matk', desc:'凝聚水球攻击。对火系克制。'},
  ice_crystal:{name:'冰晶术', elem:'ice', ap:1, mp:6, power:1.7, atkKind:'matk', effect:{freeze:30}, desc:'凝冰攻击，概率冰冻。'},
  silk_thread:{name:'千缕银丝', elem:'ice', ap:1, mp:5, power:1.1, atkKind:'matk', effect:{bind:40}, desc:'冰丝束缚，概率行动不能。'},
  water_veil:{name:'水之帷幕', elem:'water', ap:1, mp:6, power:0, atkKind:'matk', effect:{shield:12}, desc:'凝结水膜，获得护盾。'},
  frost_armor:{name:'霜铠', elem:'ice', ap:1, mp:6, power:0, atkKind:'matk', effect:{atkUp:0, defUp:3}, desc:'体表凝霜，提升防御。'},
  domain_frost:{name:'霜域', elem:'ice', ap:2, mp:12, power:1.0, atkKind:'matk', effect:{freeze:50}, desc:'展开低温领域，群体冰冻。'},
  zero_field:{name:'绝对零度', elem:'ice', ap:2, mp:20, power:2.6, atkKind:'matk', effect:{selfDmg:0.1}, desc:'极致降温，重创并可能自伤。'},
  soft_cut:{name:'送刀', elem:'phys', ap:1, mp:3, power:1.3, atkKind:'atk', effect:{atkUp:1}, desc:'低耗刀势，附带魔力。'},
  wind_afterimage:{name:'风行残像', elem:'wind', ap:1, mp:5, power:1.2, atkKind:'atk', effect:{evade:1}, desc:'借风位移，闪避提升。'},
  mana_cycle:{name:'魔战循环', elem:'water', ap:1, mp:8, power:0.9, atkKind:'matk', effect:{manaGain:10}, desc:'攻击并汲取魔力。'},
  instant_ice:{name:'隔空凝冰', elem:'ice', ap:1, mp:7, power:1.85, atkKind:'matk', effect:{freeze:45}, desc:'跳过手部节点直接凝冰截击，高概率冰冻。'},
};
// 玩家可用主动技（依已学技能推导）
function playerCombatSkills(){
  const ids = ['attack'];
  const learn = (cid, sid)=>{ if(hasSkill(cid) || (S.skillsLearned||[]).includes(cid)) if(COMBAT_SKILLS[sid] && !ids.includes(sid)) ids.push(sid); };
  learn('water_ball','water_ball');
  learn('ice_crystal','ice_crystal');
  learn('silk_thread','silk_thread');
  learn('water_veil','water_veil');
  learn('water_veil_s','water_veil');
  learn('frost_armor','frost_armor');
  learn('domain_frost','domain_frost');
  learn('zero_field','zero_field');
  learn('soft_cut','soft_cut');
  learn('wind_afterimage','wind_afterimage');
  learn('mana_cycle','mana_cycle');
  learn('instant_ice','instant_ice');
  // 水/冰基础亲和始终可用
  if(S.affinity && S.affinity.includes('water') && !ids.includes('water_ball')) ids.push('water_ball');
  if(S.affinity && S.affinity.includes('ice') && !ids.includes('ice_crystal')) ids.push('ice_crystal');
  return ids.map(id=>COMBAT_SKILLS[id]).filter(Boolean);
}

// —— 玩家战斗属性（接入养成四维）——
function playerAtk(){ return S.atk + (S.stats?.body||5)*0.2; }           // 体能→物攻
function playerMatk(){ return S.mag + (S.stats?.mana||10)*0.3; }         // 魔力适性→魔攻
function playerDef(){ return S.pdef + (S.stats?.charm||8)*0.12; }        // 气质→物防
function playerMdef(){ return S.mdef + (S.stats?.mind||15)*0.12; }       // 心智→魔防
function playerCrit(){ return Math.min(0.5, (S.stats?.mind||15)*0.003); }// 心智→暴击率
function playerSpeed(){ return 1 + (S.stats?.body||5)*0.005; }

// —— 敌人模板库 ——
const ENEMY_TEMPLATES = {
  wolf:{name:'灰狼', emoji:'🐺', elem:'wind', hp:30, atk:5, def:1, mdef:1, exp:18, gold:4, weak:'ice', desc:'北林常见的灰狼。'},
  ice_wolf:{name:'冰牙狼', emoji:'🐺', elem:'ice', hp:55, atk:8, def:2, mdef:4, exp:40, gold:8, weak:'fire', desc:'吐息带寒气的狼。'},
  boar:{name:'铁甲野猪', emoji:'🐗', elem:'earth', hp:75, atk:7, def:8, mdef:2, exp:45, gold:10, weak:'ice', desc:'皮糙肉厚的野猪。'},
  slime_fire:{name:'火焰史莱姆', emoji:'🟠', elem:'fire', hp:40, atk:9, def:2, mdef:3, exp:35, gold:7, weak:'water', desc:'燃烧的史莱姆。'},
  golem:{name:'岩傀儡', emoji:'🗿', elem:'earth', hp:110, atk:10, def:10, mdef:4, exp:70, gold:15, weak:'ice', desc:'石质的魔像。'},
  wolf_king:{name:'雪狼王', emoji:'🐺', elem:'ice', hp:160, atk:14, def:6, mdef:8, exp:150, gold:40, weak:'fire', desc:'北林之主。', boss:true},
  shadow_jackal:{name:'霜脊影豺', emoji:'🐺', elem:'wind', hp:110, atk:11, def:4, mdef:5, exp:85, gold:18, weak:'ice', desc:'潜伏在北林东北山谷暗影中的凶悍魔物。'},
  frost_lizard:{name:'裂岩冰蜥', emoji:'🦎', elem:'ice', hp:135, atk:13, def:7, mdef:6, exp:120, gold:25, weak:'phys', desc:'身披厚重灰蓝冰甲、冲撞力惊人的赫兰冻土巨兽。', boss:true},
};
// 由敌人 id/配置生成战斗实例
function spawnEnemy(cfg){
  const t = ENEMY_TEMPLATES[cfg.tpl] || cfg;
  const lv = S.lv || 1;
  const scale = cfg.scale || 1;
  return {
    name: t.name, emoji: t.emoji, elem: t.elem,
    hp: Math.round((t.hp + lv*1.5) * scale), mhp: Math.round((t.hp + lv*1.5) * scale),
    atk: Math.round((t.atk + lv*0.4) * scale), def: t.def, mdef: t.mdef,
    weak: t.weak, exp: t.exp, gold: t.gold, boss: !!t.boss,
    status:{}, shield:0,
  };
}
function startBattle(cfg, done){
  B = { enemy: spawnEnemy(cfg), cfg:cfg||{}, done, ap:2, apMax:2, turn:0, log:[], over:false };
  setBG('bg-battle'); bgmPlayType('battle', {force:true}); show('battle-screen',1);
  renderBattle();
}
// 战斗/决斗结束：若仍在场景内则恢复场景 bgm
function bgmEndBattle(){
  show('battle-screen',0);
  bgmRestoreScene();
}
function battleLog(msg){
  if(!B) return;
  B.log.push(msg);
  const el=$('b-log'); if(el){ el.innerHTML = B.log.join('<br>'); el.scrollTop=el.scrollHeight; }
}
// 计算伤害：攻击/魔攻 × 系数 × 元素 × 随机 ± 10%，减对方防御
function calcDamage(sk, atkVal, defVal){
  const base = atkVal * (sk.power||1);
  const raw = base * (0.9 + Math.random()*0.2);
  const mult = elemMult(sk.elem, B.enemy.elem);
  let dmg = raw * mult - defVal * 0.5;
  return { dmg: Math.max(1, Math.floor(dmg)), mult };
}
function applyStatus(target, key, turns){
  target.status = target.status || {};
  target.status[key] = (target.status[key]||0) + turns;
}
function tickStatuses(target){
  // 每回合结束递减状态，并结算持续伤害
  target.status = target.status || {};
  let msg='';
  if(target.status.burn){ const d=Math.max(1,Math.floor(target.mhp*0.06)); target.hp-=d; msg+=`灼烧 ${d} `; target.status.burn--; if(target.status.burn<=0) delete target.status.burn; }
  if(target.status.freeze){ target.status.freeze--; if(target.status.freeze<=0) delete target.status.freeze; }
  if(target.status.bind){ target.status.bind--; if(target.status.bind<=0) delete target.status.bind; }
  if(target.status.defUp){ target.status.defUp--; if(target.status.defUp<=0) delete target.status.defUp; }
  if(target.status.atkUp){ target.status.atkUp--; if(target.status.atkUp<=0) delete target.status.atkUp; }
  if(target.status.evade){ target.status.evade--; if(target.status.evade<=0) delete target.status.evade; }
  if(target.hp<=0) target.hp=0;
  return msg;
}
function renderBattle(){
  if(!B) return;
  const e=B.enemy;
  $('b-emoji').textContent=e.emoji;
  $('b-ename').textContent=`${e.name}${e.boss?'（BOSS）':''}（${ELEM_NAME[e.elem]||''}）`;
  $('b-ehp').style.width=(Math.max(0,e.hp)/e.mhp*100)+'%';
  $('b-ehp-num').textContent=`${Math.max(0,e.hp)}/${e.mhp}`;
  // 玩家行动
  const acts=$('b-actions'); acts.innerHTML='';
  const sbar = document.createElement('div');
  sbar.className='b-status';
  sbar.innerHTML=`行动点 <b style="color:var(--gold)">${'◆'.repeat(B.ap)}${'◇'.repeat(B.apMax-B.ap)}</b>　HP ${S.hp}/${S.mhp}　MP ${S.mp}/${S.mmp}${B.turn>0?'　回合 '+B.turn:''}`;
  acts.appendChild(sbar);
  const skills = playerCombatSkills();
  skills.forEach(sk=>{
    const b=document.createElement('button'); b.className='choice';
    const apTxt = sk.ap>1?` [AP${sk.ap}]`:'';
    const mpTxt = sk.mp>0?` [MP${sk.mp}]`:'';
    const critTxt = sk.elem&&sk.elem!=='phys'?`（${ELEM_NAME[sk.elem]}）`:'';
    b.textContent=`${sk.name}${critTxt}${apTxt}${mpTxt}`;
    b.disabled = B.ap < sk.ap || (sk.mp>0 && S.mp < sk.mp) || B.over;
    b.title = sk.desc || '';
    b.onclick=()=>playerAct(sk);
    acts.appendChild(b);
  });
  const pass=document.createElement('button'); pass.className='choice'; pass.textContent='结束回合（攒1AP）';
  pass.disabled=B.over; pass.onclick=()=>endPlayerTurn(true);
  acts.appendChild(pass);
  const run=document.createElement('button'); run.className='choice'; run.textContent='逃跑';
  run.onclick=()=>{ if(B.over) return; bgmEndBattle(); battleLog('你逃跑了。'); toast('逃跑成功'); const d=B.done; B=null; if(d) d(); else if(S.freeRoam) enterFreeRoam(); };
  acts.appendChild(run);
}
function playerAct(sk){
  if(!B || B.over) return;
  if(B.ap < sk.ap){ battleLog('行动点不足。'); return; }
  if(sk.mp>0 && S.mp < sk.mp){ battleLog('魔力值不足。'); sfx('bad'); return; }
  B.ap -= sk.ap; if(sk.mp) S.mp -= sk.mp;
  const e=B.enemy;
  // 命中（考虑风行残像闪避）
  const atkVal = sk.atkKind==='matk' ? playerMatk() : playerAtk();
  if(sk.power>0){
    const {dmg, mult} = calcDamage(sk, atkVal, e.def);
    let final = dmg;
    if(Math.random()<playerCrit()) final = Math.floor(final*1.5);
    e.hp -= final;
    let s=`你的${sk.name}对${e.name}造成 ${final} 伤害`;
    if(mult>1) s+='（克制！）'; if(mult<1) s+='（抵抗…）';
    battleLog(s);
    sfx('magic');
    // 状态效果
    if(sk.effect && sk.effect.freeze){ if(Math.random()*100 < sk.effect.freeze) applyStatus(e,'freeze',1); }
    if(sk.effect && sk.effect.bind){ if(Math.random()*100 < sk.effect.bind) applyStatus(e,'bind',1); }
    if(sk.effect && sk.effect.defUp){ applyStatus(B?'playerB':null,'defUp',sk.effect.defUp); }
    if(sk.effect && sk.effect.atkUp){ applyStatus(null,'atkUp',sk.effect.atkUp); }
    if(sk.effect && sk.effect.selfDmg){ const self=Math.max(1,Math.floor(S.hp*sk.effect.selfDmg)); S.hp-=self; battleLog(`绝对零度反噬自身 ${self} 伤害`); }
  } else {
    // 非伤害（护盾/buff）
    if(sk.effect && sk.effect.shield){ e.shield = (e.shield||0)+sk.effect.shield; battleLog(`水之帷幕：${e.name}获得护盾 ${sk.effect.shield}`); }
    if(sk.effect && sk.effect.atkUp){ applyStatus(e,'atkUp',sk.effect.atkUp); battleLog(`${e.name} 攻击提升`); }
    if(sk.effect && sk.effect.manaGain){ const g=Math.min(S.mmp, S.mp+sk.effect.manaGain); battleLog(`魔战循环汲取魔力 +${g-S.mp}`); S.mp=g; }
    if(sk.effect && sk.effect.freeze && sk.effect.power===0){ /* domain buff handled above */ }
  }
  // 护盾吸收
  if(e.shield>0 && e.hp<0){ const over=-e.hp; e.shield-=over; if(e.shield<0){e.hp=e.shield; e.shield=0;} else e.hp=0; }
  updateHUD();
  if(e.hp<=0){ winBattle(); return; }
  if(B.ap<=0) endPlayerTurn(false);
  else renderBattle();
}
function endPlayerTurn(bank){
  if(!B||B.over) return;
  B.turn++;
  if(bank) B.ap = Math.min(B.apMax+1, B.ap+1); // 攒AP
  else B.ap = B.apMax;
  enemyTurn();
}
function enemyTurn(){
  const e=B.enemy;
  // 状态结算
  if(e.status.freeze){ battleLog(`${e.name} 被冰冻，无法行动！`); tickStatuses(e); if(e.hp<=0){winBattle();return;} endRound(); return; }
  if(e.status.bind){ battleLog(`${e.name} 被束缚，无法行动！`); tickStatuses(e); if(e.hp<=0){winBattle();return;} endRound(); return; }
  const burnMsg=tickStatuses(e); if(burnMsg) battleLog(`${e.name} ${burnMsg.trim()}`); if(e.hp<=0){winBattle();return;}
  // 敌人攻击
  const atkMul = e.status.atkUp?1.3:1;
  const base = e.atk * atkMul;
  const raw = base * (0.85+Math.random()*0.3);
  const defVal = playerDef();
  let dmg = Math.max(1, Math.floor(raw - defVal*0.5));
  // 玩家闪避
  if(e.status && false){} 
  S.hp = clamp(S.hp-dmg,0,S.mhp);
  battleLog(`${e.name} 攻击，造成 ${dmg} 伤害！`);
  sfx('bad');
  updateHUD();
  if(S.hp<=0){ defeat(); return; }
  endRound();
}
function endRound(){
  if(!B||B.over) return;
  B.ap = B.apMax;
  renderBattle();
}
function winBattle(){
  if(!B||B.over) return;
  B.over=true;
  battleLog(`🎉 击败了 ${B.enemy.name}！经验+${B.enemy.exp} 金币+${B.enemy.gold}`);
  addExp(B.enemy.exp); S.gold+=B.enemy.gold||0; updateHUD(); sfx('level');
  const done=B.done, enemy=B.enemy;
  setTimeout(()=>{ bgmEndBattle(); B=null; if(done) done(); else if(S.freeRoam) enterFreeRoam(); }, 800);
}
function defeat(){
  if(!B||B.over) return;
  B.over=true; S.deaths++; S.hp=1;
  battleLog('……意识模糊。被人救了回来。');
  setTimeout(()=>{ bgmEndBattle(); B=null; S.loc=S.lastSafe; enterFreeRoam(); toast('重伤撤回'); }, 800);
}

// ========== VIRTUAL DUEL ==========
function openDuelMenu(){
  if(!hasSkill('virtual_duel')){ toast('尚未掌握虚拟决斗'); return; }
  const ready = Object.keys(S.know).filter(id=>(S.know[id]||0)>=90);
  if(!ready.length){ toast('没有了解度≥90%的可挑战对象'); return; }
  const choices = ready.map(id=>({
    text:`挑战 ${CHARS[id]?.short||id}（了解度 ${S.know[id]}%）`,
    do:()=>runDuel(id)
  }));
  choices.push({text:'取消', do:()=>enterFreeRoam()});
  playLines([{text:'要挑战谁？', choices}]);
}
function runDuel(id){
  const n=S.know[id]||90;
  const ch=CHARS[id]||{name:id};
  // 对手技能：依据角色属性拟一个
  const oppSkills = ['attack','water_ball','ice_crystal'].filter(s=>COMBAT_SKILLS[s]);
  B = {
    enemy: { name: ch.name, emoji:'⚔️', elem:'water', hp:Math.round(60+n*0.6), mhp:Math.round(60+n*0.6), atk:Math.round(6+n*0.12), def:Math.round(3+n*0.05), mdef:3, weak:'fire', exp:30, gold:0, boss:false, status:{}, shield:0, duel:true },
    cfg:{}, done:()=>{}, ap:2, apMax:2, turn:0, log:[], over:false, duelId:id
  };
  show('duel-screen',1); setBG('bg-duel'); bgmPlayType('battle', {force:true});
  $('duel-info').innerHTML=`对手：${ch.name}<br>了解度 ${n}% · 难度 ${n>=95?'★★★':n>=93?'★★':'★'}`;
  battleLog('决斗开始！');
  renderBattle();
}
function winDuel(id){
  if(!B) return;
  const key=id+'_cur';
  if(!S.duelWins.includes(key)) S.duelWins.push(key);
  const rew = DUEL_REWARDS[id+'_11']||DUEL_REWARDS[id+'_9']||DUEL_REWARDS[id+'_14']||DUEL_REWARDS[id+'_cur']||{id:'duel_'+id,name:'战斗经验',desc:'实战感觉提升。'};
  if(rew.id && !hasSkill(rew.id)) addSkill(rew.id);
  ach('virtual_first');
  battleLog(`🎉 胜利！获得：${rew.name}`);
  $('duel-actions').innerHTML=`<button class="choice" onclick="document.getElementById('duel-screen').classList.add('hidden');bgmRestoreScene();B=null;enterFreeRoam()">确认</button>`;
  addExp(30); sfx('ok');
  updateHUD();
}

// ========== PANEL ==========
function buildStatsRadarSVG(stats){
  const st = stats || {};
  const cx = 140, cy = 125, R = 74, orbitR = R + 11;
  const norm = v => Math.max(0.14, Math.min(1, (Number(v) || 0) / 100));
  const b = norm(st.body), m = norm(st.mind), ma = norm(st.mana), ch = norm(st.charm);
  const fmt = n => Number(n.toFixed(1));
  const pt = (r, ang) => [
    fmt(cx + Math.cos(ang) * R * r),
    fmt(cy + Math.sin(ang) * R * r),
  ];
  const ticks = Array.from({length: 8}, (_, i) => {
    const ang = -Math.PI / 2 + i * (Math.PI / 4);
    const major = i % 2 === 0;
    const r1 = orbitR - (major ? 4.5 : 3);
    const r2 = orbitR + (major ? 2.2 : 1.6);
    const x1 = fmt(cx + Math.cos(ang) * r1);
    const y1 = fmt(cy + Math.sin(ang) * r1);
    const x2 = fmt(cx + Math.cos(ang) * r2);
    const y2 = fmt(cy + Math.sin(ang) * r2);
    return `<line class="radar-tick" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${major ? 'rgba(125, 211, 252, 0.72)' : 'rgba(125, 211, 252, 0.42)'}" stroke-width="${major ? '1.25' : '0.9'}" stroke-linecap="round"/>`;
  }).join('');
  const rings = [0.25, 0.5, 0.75, 1].map(r=>{
    const pts = [pt(r, -Math.PI/2), pt(r, 0), pt(r, Math.PI/2), pt(r, Math.PI)].map(p=>p.join(',')).join(' ');
    return r === 1
      ? `<polygon class="radar-outer-ring" points="${pts}" fill="rgba(18, 80, 230, 0.08)" stroke="rgba(56, 189, 248, 0.66)" stroke-width="1.25"/>`
      : `<polygon class="radar-ring" points="${pts}" fill="none" stroke="rgba(125, 211, 252, 0.22)" stroke-width="1"/>`;
  }).join('');
  const vTop = pt(b, -Math.PI/2), vRight = pt(m, 0), vBot = pt(ma, Math.PI/2), vLeft = pt(ch, Math.PI);
  const dataPts = [vTop, vRight, vBot, vLeft].map(p=>p.join(',')).join(' ');
  const diamondNode = ([x, y]) => {
    const o = 8.2, s = 4.6, c = 1.8;
    return `<polygon class="radar-node-halo" fill="rgba(56, 189, 248, 0.30)" stroke="rgba(125, 211, 252, 0.76)" stroke-width="0.9" points="${x},${fmt(y-o)} ${fmt(x+o)},${y} ${x},${fmt(y+o)} ${fmt(x-o)},${y}"/>` +
      `<polygon class="radar-dot radar-node" fill="#FFFFFF" stroke="#38BDF8" stroke-width="1.5" points="${x},${fmt(y-s)} ${fmt(x+s)},${y} ${x},${fmt(y+s)} ${fmt(x-s)},${y}"/>` +
      `<polygon class="radar-node-core" fill="#1250E6" points="${x},${fmt(y-c)} ${fmt(x+c)},${y} ${x},${fmt(y+c)} ${fmt(x-c)},${y}"/>`;
  };
  return `<svg class="stats-radar-svg" viewBox="0 0 280 250" role="img" aria-label="养成四维星象雷达">
    <defs>
      <radialGradient id="prismChamberGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.30"/>
        <stop offset="52%" stop-color="#1250E6" stop-opacity="0.16"/>
        <stop offset="100%" stop-color="#071229" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="prismRadarFill" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#38BDF8" stop-opacity="0.56"/>
        <stop offset="55%" stop-color="#1250E6" stop-opacity="0.36"/>
        <stop offset="100%" stop-color="#60A5FA" stop-opacity="0.48"/>
      </linearGradient>
      <filter id="prismRadarGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.6" result="prismBlur"/>
        <feMerge>
          <feMergeNode in="prismBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>
    <circle class="radar-chamber-glow" cx="${cx}" cy="${cy}" r="${R + 8}" fill="url(#prismChamberGlow)"/>
    <circle class="radar-orbit" cx="${cx}" cy="${cy}" r="${orbitR}" fill="none" stroke="rgba(125, 211, 252, 0.28)" stroke-width="0.9" stroke-dasharray="3 6"/>
    ${ticks}
    ${rings}
    <line class="radar-axis" x1="${cx}" y1="${cy-R}" x2="${cx}" y2="${cy+R}" stroke="rgba(125, 211, 252, 0.36)" stroke-width="1"/>
    <line class="radar-axis" x1="${cx-R}" y1="${cy}" x2="${cx+R}" y2="${cy}" stroke="rgba(125, 211, 252, 0.36)" stroke-width="1"/>
    <line class="radar-axis-diag" x1="${fmt(cx-R*0.52)}" y1="${fmt(cy-R*0.52)}" x2="${fmt(cx+R*0.52)}" y2="${fmt(cy+R*0.52)}" stroke="rgba(125, 211, 252, 0.16)" stroke-width="0.85" stroke-dasharray="2 4"/>
    <line class="radar-axis-diag" x1="${fmt(cx+R*0.52)}" y1="${fmt(cy-R*0.52)}" x2="${fmt(cx-R*0.52)}" y2="${fmt(cy+R*0.52)}" stroke="rgba(125, 211, 252, 0.16)" stroke-width="0.85" stroke-dasharray="2 4"/>
    <polygon class="radar-poly" fill="url(#prismRadarFill)" stroke="#38BDF8" stroke-width="2.2" stroke-linejoin="round" filter="url(#prismRadarGlow)" points="${dataPts}"/>
    ${diamondNode(vTop)}
    ${diamondNode(vRight)}
    ${diamondNode(vBot)}
    ${diamondNode(vLeft)}
    <text class="radar-label" x="${cx}" y="18" text-anchor="middle" fill="#FFFFFF" font-size="12.5" font-weight="700">体能</text>
    <text class="radar-val" x="${cx}" y="33" text-anchor="middle" fill="#7DD3FC" font-size="12" font-weight="900">${st.body|0}</text>
    <text class="radar-label" x="${cx+R+18}" y="${cy-2}" text-anchor="start" fill="#FFFFFF" font-size="12.5" font-weight="700">心智</text>
    <text class="radar-val" x="${cx+R+18}" y="${cy+14}" text-anchor="start" fill="#7DD3FC" font-size="12" font-weight="900">${st.mind|0}</text>
    <text class="radar-label" x="${cx}" y="${cy+R+26}" text-anchor="middle" fill="#FFFFFF" font-size="12.5" font-weight="700">魔力适性</text>
    <text class="radar-val" x="${cx}" y="${cy+R+41}" text-anchor="middle" fill="#7DD3FC" font-size="12" font-weight="900">${st.mana|0}</text>
    <text class="radar-label" x="${cx-R-18}" y="${cy-2}" text-anchor="end" fill="#FFFFFF" font-size="12.5" font-weight="700">气质</text>
    <text class="radar-val" x="${cx-R-18}" y="${cy+14}" text-anchor="end" fill="#7DD3FC" font-size="12" font-weight="900">${st.charm|0}</text>
  </svg>`;
}

function openStatsPanel(){
  if(!S.stats) S.stats = {body:5, mind:15, mana:10, charm:8};
  const body = $('stats-body');
  if(!body){ openPanel('status'); return; }
  const sE = flag('named');
  const sSrc = sE ? resolvePortrait('sylvia', 'normal') : null;
  const nm = !sE ? '未命名' : (S.alias || S.name || '希尔维亚');
  const totalPower = (S.stats.body|0) + (S.stats.mind|0) + (S.stats.mana|0) + (S.stats.charm|0);
  const idBarHTML = `<div class="stats-id-bar">
    <div class="stats-id-avatar">${sSrc ? `<img src="${sSrc}" alt="${nm}"/>` : `<span class="stats-id-fallback">✦</span>`}</div>
    <div class="stats-id-meta">
      <div class="stats-id-name">${nm}</div>
      <div class="stats-id-sub">${ageStr()} · ${tierName()}</div>
    </div>
    <div class="stats-id-score"><span>综合潜能</span><b>${totalPower}</b></div>
  </div>`;
  const meta = {
    body:{name:'体能', en:'VITALITY', tip:'剑术、奔跑、持剑。影响近战与负重耐性。'},
    mind:{name:'心智', en:'INTELLECT', tip:'学习、记忆、理论。影响课程收益与了解度获取。'},
    mana:{name:'魔力适性', en:'AETHER', tip:'导引与塑形。影响法术稳定与魔力成长。'},
    charm:{name:'气质', en:'PRESENCE', tip:'仪态与人情。影响交谈、好感与交涉。'},
  };
  const cardsHTML = ['body','mind','mana','charm'].map(k=>{
    const v = Math.max(0, Math.min(100, S.stats[k]|0));
    return `<div class="stats-rune-card ${k}">
      <div class="si-top"><span class="si-name">${meta[k].name} <small>${meta[k].en}</small></span><span class="si-val">${v}</span></div>
      <div class="si-bar"><i style="width:${v}%"></i></div>
      <div class="si-tip">${meta[k].tip}</div>
    </div>`;
  }).join('');
  const courseEntries = Object.entries(S.courses||{});
  const courseHTML = courseEntries.length
    ? `<div class="scr-list">${courseEntries.map(([id,st])=>{ const c=COURSES[id]; const lv = (st && typeof st === 'object') ? (st.lv || 1) : (st || 1); return `<span class="scr-pill"><span class="scr-name">${c?c.name:id}</span><em class="scr-lv">Lv.${lv}</em></span>`; }).join('')}</div>`
    : `<div class="scr-empty">尚未开启系统课程，可于自由探索底部「课程」择师修习。</div>`;
  body.innerHTML = `
    <div class="stats-split-layout">
      <div class="stats-radar-stage stats-radar-box">
        ${idBarHTML}
        <div class="stats-radar-viewport">
          ${buildStatsRadarSVG(S.stats)}
        </div>
        <div class="stats-radar-caption">AETHER PRISM · FOUR-AXIS ASTROLABE</div>
      </div>
      <div class="stats-detail-col">
        <div class="stats-rune-grid">${cardsHTML}</div>
        <div class="stats-course-ribbon">
          <div class="scr-title">课程进阶录</div>
          ${courseHTML}
        </div>
      </div>
    </div>`;
  show('stats-overlay', 1);
  sfx('open');
}

// 单一数据源：右上角「状态」面板与剧情里的系统面板共用此渲染（保证数值永远一致）
function statusPanelHTML(){
  const named = flag('named');
  const nm = !named ? '？？？（未命名）' : (S.alias || S.name);
  const src = named ? resolvePortrait('sylvia', 'normal') : null;
  const expPct = S.next ? Math.min(100, Math.round((Math.floor(S.exp) / S.next) * 100)) : 0;
  const hpPct = S.mhp ? Math.min(100, Math.round((S.hp / S.mhp) * 100)) : 0;
  const mpPct = S.mmp ? Math.min(100, Math.round((S.mp / S.mmp) * 100)) : 0;
  const stPct = S.mst ? Math.min(100, Math.round((S.st / S.mst) * 100)) : 0;
  const picksLen = Array.isArray(S.picksDone) ? S.picksDone.length : 0;
  const starsHTML = Array.from({length:7}, (_,i)=>`<span class="sc-star-node${i < picksLen ? ' lit' : ''}" title="勇者之赐 第${i+1}星"></span>`).join('');
  let relicStripHTML = '';
  if(typeof RelicsAndEvents !== 'undefined' && RelicsAndEvents.getActiveRelicsForBattle){
    const eq = (S.equippedRelics || []).filter(Boolean);
    const cat = RelicsAndEvents.RELICS_CATALOG || RelicsAndEvents.RELICS || {};
    const syns = RelicsAndEvents.getActiveSynergies ? RelicsAndEvents.getActiveSynergies(eq) : [];
    if(eq.length || syns.length){
      relicStripHTML = `<div class="sc-relic-strip">
        <span class="sc-relic-label">随身铭记</span>
        ${eq.map(id=>`<span class="sc-relic-chip">${cat[id]?.name || id}</span>`).join('')}
        ${syns.map(sy=>`<span class="sc-synergy-pill">✦ ${sy.name} (${sy.count})</span>`).join('')}
      </div>`;
    }
  }
  const astrolabeSVG = `<svg class="sc-astrolabe-ring" viewBox="0 0 200 200" fill="none" aria-hidden="true">
    <circle cx="100" cy="100" r="94" stroke="currentColor" stroke-width="0.9" stroke-dasharray="4 6" opacity="0.55"/>
    <circle cx="100" cy="100" r="78" stroke="currentColor" stroke-width="1" opacity="0.4"/>
    <polygon points="100,14 174,57 174,143 100,186 26,143 26,57" stroke="currentColor" stroke-width="0.85" opacity="0.34"/>
    <polygon points="100,26 116,84 174,100 116,116 100,174 84,116 26,100 84,84" stroke="currentColor" stroke-width="0.75" opacity="0.3"/>
    <line x1="100" y1="6" x2="100" y2="20" stroke="currentColor" stroke-width="1.2" opacity="0.65"/>
    <line x1="100" y1="180" x2="100" y2="194" stroke="currentColor" stroke-width="1.2" opacity="0.65"/>
    <line x1="6" y1="100" x2="20" y2="100" stroke="currentColor" stroke-width="1.2" opacity="0.65"/>
    <line x1="180" y1="100" x2="194" y2="100" stroke="currentColor" stroke-width="1.2" opacity="0.65"/>
  </svg>`;
  return `<div class="sys-chronicle">
    <div class="sc-portrait-col">
      <div class="sc-portrait-frame">
        ${astrolabeSVG}
        ${src ? `<img class="sc-portrait-img" src="${src}" alt="${nm}"/>` : `<div class="sc-portrait-fallback">✦</div>`}
      </div>
      <div class="sc-name-plate">
        <div class="sc-display-name"><b>名字</b> ${nm}</div>
        <div class="sc-phase-sub"><b>阶段</b> ${phaseName()} · <b>日期</b> ${dateStr()}</div>
      </div>
      <div class="sc-crest-row">
        <span class="sc-lv-badge"><b>等级</b> Lv.${S.lv}</span>
        <span class="sc-tier-seal"><b>等阶</b> ${tierName()}</span>
      </div>
      <div class="sc-exp-wrap">
        <div class="sc-exp-head"><span><b>经验</b> ${Math.floor(S.exp)}/${S.next}</span><span>${expPct}%</span></div>
        <div class="sc-exp-track"><i class="sc-exp-fill" style="width:${expPct}%"></i></div>
      </div>
      <div class="sc-constellation">
        <div class="sc-const-head"><span>勇者之赐命盘</span><em>${picksLen}/7</em></div>
        <div class="sc-const-nodes">${starsHTML}</div>
      </div>
    </div>
    <div class="sc-data-col">
      <div class="sc-vitals">
        <div class="sc-vital-row hp">
          <div class="sc-vital-head"><span class="sc-vital-lbl"><b>生命</b> ${S.hp}/${S.mhp}</span><span class="sc-vital-val">HP</span></div>
          <div class="sc-vital-track"><i class="sc-vital-fill" style="width:${hpPct}%"></i></div>
        </div>
        <div class="sc-vital-row mp">
          <div class="sc-vital-head"><span class="sc-vital-lbl"><b>魔力值</b> ${S.mp}/${S.mmp}</span><span class="sc-vital-val">AETHER MP</span></div>
          <div class="sc-vital-track"><i class="sc-vital-fill" style="width:${mpPct}%"></i></div>
        </div>
        <div class="sc-vital-row st">
          <div class="sc-vital-head"><span class="sc-vital-lbl"><b>体力</b> ${S.st}/${S.mst}</span><span class="sc-vital-val">STAMINA</span></div>
          <div class="sc-vital-track"><i class="sc-vital-fill" style="width:${stPct}%"></i></div>
        </div>
      </div>
      <div class="sc-attr-matrix">
        <div class="sc-attr-tile atk"><b>攻击</b> ${Math.floor(S.atk)}<span class="sc-attr-en">PHYSICAL ATK</span></div>
        <div class="sc-attr-tile mag"><b>魔力</b> ${Math.floor(S.mag)}<span class="sc-attr-en">ARCANE MAG</span></div>
        <div class="sc-attr-tile pdef"><b>物抗</b> ${S.pdef}<span class="sc-attr-en">WARD DEF</span></div>
        <div class="sc-attr-tile mdef"><b>法抗</b> ${S.mdef}<span class="sc-attr-en">AETHER RES</span></div>
      </div>
      <div class="sc-meta-grid">
        <div class="sc-meta-item"><b>年龄</b> ${ageStr()}</div>
        <div class="sc-meta-item"><b>金币</b> ${S.gold}</div>
        <div class="sc-meta-item sc-meta-wide"><b>亲和</b> <span class="sc-elem-group"><span class="sc-elem-pill ice">✦ 冰</span><span class="sc-elem-pill water">◇ 水</span></span></div>
      </div>
      ${relicStripHTML}
    </div>
  </div>`;
}

const SAVE_SLOTS_KEY = 'ojousama_manual_slots_v1';
function loadManualSlots(){
  try {
    const d = JSON.parse(localStorage.getItem(SAVE_SLOTS_KEY) || '{}');
    return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
  } catch(e){ return {}; }
}
function writeManualSlots(slots){
  try { localStorage.setItem(SAVE_SLOTS_KEY, JSON.stringify(slots || {})); } catch(e){}
}
function formatSlotTime(ts){
  if(!ts) return '';
  try{
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }catch(e){ return ''; }
}
function saveToManualSlot(slotId){
  const slots = loadManualSlots();
  slots[slotId] = {
    ts: Date.now(),
    label: `${!flag('named') ? '？？？' : (S.alias || S.name || '希尔维亚')} · ${ageStr()}`,
    date: dateStr(),
    loc: LOCS[S.loc]?.name || S.loc || '',
    phase: phaseName(),
    data: JSON.parse(JSON.stringify(S))
  };
  writeManualSlots(slots);
  toast(`已保存至档案槽位 ${slotId}`);
  openPanel('saves');
}
function loadFromManualSlot(slotId){
  const slots = loadManualSlots();
  const entry = slots[slotId];
  if(!entry || !entry.data){ toast('该槽位尚无记录'); return; }
  const raw = migrateStorySave(entry.data);
  S = Object.assign(baseState(), raw);
  if(typeof BranchingDirector !== 'undefined' && BranchingDirector.ensureCausalState){
    BranchingDirector.ensureCausalState(S);
  }
  Object.values(LOCS).forEach(L=>{
    if(L.area==='公爵府') L.unlock=true;
    if(S.phase==='academy'||S.phase==='journey'||S.phase==='finale'){
      if(L.area==='魔法大学') L.unlock=true;
    }
    if(S.phase==='journey'||S.phase==='finale'){
      if(['road','jikan','chenglan_guild','northforest','town','market'].includes(L.id)) L.unlock=true;
      if(flag('ch_distant_wind_2') && L.id==='ice_canyon') L.unlock=true;
    }
  });
  save();
  show('panel', 0);
  show('title-screen', 0);
  show('game-screen', 1);
  updateHUD();
  updateLocBar();
  if(resumePendingStories()) return;
  if(checkStoryGates()) return;
  if(S.freeRoam) enterFreeRoam();
  else playLines([{text:`（读取档案 ${slotId}）${dateStr()} · ${LOCS[S.loc]?.name||''}`, freeRoam:true}]);
}
function deleteManualSlot(slotId){
  const slots = loadManualSlots();
  delete slots[slotId];
  writeManualSlots(slots);
  toast(`已清理档案槽位 ${slotId}`);
  openPanel('saves');
}
function getUnlockedChaptersList(){
  const chaps = (typeof STORY_CHAPTERS !== 'undefined') ? STORY_CHAPTERS : (typeof window !== 'undefined' && Array.isArray(window.STORY_CHAPTERS) ? window.STORY_CHAPTERS : []);
  return chaps.filter(ch => {
    if(!ch || !ch.id || !SCENES[ch.id] || ch.id === 's_ending_menu') return false;
    if(ch.id === 's_start') return true;
    const gateKeys = STORY_GATE_BY_SCENE[ch.id] || [];
    if(gateKeys.some(k => !!flag(k))) return true;
    if(ch.flag && flag(ch.flag)) return true;
    return false;
  });
}

function openPanel(tab){
  show('sys-popup',0);
  show('panel',1); sfx('open');
  const tabs=[['status','状态'],['causal','✦ 命运暗流'],['relics','✦ 铭记'],['skills','技能'],['tasks','任务'],['prof','人物'],['inv','背包'],['ach','成就'],['saves','档案'],['settings','设置']];
  $('panel-tabs').innerHTML = tabs.map(([k,n])=>`<button class="ptab${(tab||'status')===k?' on':''}" data-t="${k}">${n}</button>`).join('');
  $('panel-tabs').onclick=e=>{ const btn=e.target.closest('[data-t]'); const t=btn?btn.dataset.t:e.target.dataset.t; if(t) openPanel(t); };
  const body=$('panel-body');
  tab = tab||'status';
  if(tab==='status'){
    body.innerHTML= statusPanelHTML() + `<p style="margin-top:12px;font-size:12px;opacity:.75">养成四维请点顶部「养成四维」独立菱晶按钮。<br>「勇者之赐」已用 ${S.picksDone.length}/7 次</p>`;
  } else if(tab==='causal'){
    body.innerHTML = (typeof BranchingDirector !== 'undefined' && BranchingDirector.renderCausalPanelHTML)
      ? BranchingDirector.renderCausalPanelHTML(S)
      : '<p style="opacity:.6">命运暗流模块尚未加载。</p>';
  } else if(tab==='relics'){
    if(typeof RelicsAndEvents !== 'undefined' && RelicsAndEvents.renderRelicsPanelHTML){
      body.innerHTML = RelicsAndEvents.renderRelicsPanelHTML(S);
      if(RelicsAndEvents.bindRelicsContainerEvents){
        RelicsAndEvents.bindRelicsContainerEvents(body, { state: S, onChanged: ()=>openPanel('relics') });
      }
    } else {
      body.innerHTML = '<p style="opacity:.6">随身铭记模块尚未加载。</p>';
    }
  } else if(tab==='skills'){
    const cnNames={ice_crystal:'冰晶术',virtual_duel:'虚拟决斗',ice_sense:'寒息感知',water_veil:'水之帷幕',quiet_mind:'静心',baby_talk:'天籁初声',mana_sip:'魔力小啜',silk_thread:'千缕银丝',ice_palace:'冰晶宫殿',multi_cast:'二重咏唱',frost_armor:'霜铠',deep_read:'深读',mirror_ice:'镜冰',wind_step_s:'残影步（简）',heal_touch:'温手',mana_cycle:'魔战循环',domain_frost:'霜域',perfect_cast:'无咏唱具现',fate_eye:'因果薄片',sword_mana:'魔剑同化',memory_link:'记忆连丝',zero_field:'绝对零度逼近',temp_sense:'温度感知',wind_afterimage:'风行残像',mana_calc:'魔力精算',root_ice:'生根之冰',noble_bearing:'公爵气度',lullaby:'摇篮曲',etiquette:'贵族仪态',water_ball:'水球术',basic_guard:'基本防御架',theory_note:'理论笔记',water_veil_s:'水膜',ice_sphere:'完美冰球',root_step:'生根步',soft_cut:'送刀',frost_edge:'覆冰锋',instant_ice:'隔空凝冰',stealth_edge:'覆水无痕'};
    const skillRows = !S.skills.length
      ? '<p style="opacity:.6">尚未获得特殊技能。</p>'
      : S.skills.map(id=>{
          const p=ALL_PICKS[id]||MAGIC_SKILLS[id]||Object.values(DUEL_REWARDS).find(x=>x.id===id)||{name:id,desc:''};
          const displayName = cnNames[id] || p.name || id;
          return `<div class="p-skill"><div class="sk-name">${displayName}</div><div class="sk-desc">${p.desc||''}</div></div>`;
        }).join('');
    body.innerHTML = skillRows
      + (hasSkill('virtual_duel') ? `<button class="tbtn" style="margin-top:10px" id="btn-duel">进入虚拟决斗（梦境）</button>` : '')
      + `<button class="tbtn ghost" style="margin-top:8px" id="btn-panel-arena">战术演武沙盒</button>`;
    setTimeout(()=>{
      const b=$('btn-duel'); if(b) b.onclick=()=>{ show('panel',0); openDuelMenu(); };
      const ba=$('btn-panel-arena'); if(ba) ba.onclick=()=>{ show('panel',0); if(typeof openArenaHub==='function') openArenaHub({fromTitle:false}); };
    },0);
  } else if(tab==='tasks'){
    // 未接取/未完成且未解锁的任务不显示具体内容（防剧透）
    const known = TASKS.filter(t=>{
      const st=S.tasks[t.id];
      if(st?.done) return true;
      if(st && (st.prog||0)>0) return true;
      // revealed when relevant flag/phase
      if(t.id==='first_word' && S.ageY===0) return true;
      if(t.id==='mana_sense' && S.ageY>=3) return true;
      if(t.id==='first_friend' && S.phase==='academy') return true;
      if(t.id==='ice_hits' && flag('met_aino')) return true;
      if(t.id==='taste_foreign' && flag('met_ajun')) return true;
      if(t.id==='clock_tower' && LOCS.clocktower.unlock) return true;
      if(t.id==='market_walk' && LOCS.market.unlock) return true;
      if(t.id==='lost_child' && flag('met_huke')) return true;
      if(t.id==='plant_tree' && flag('ch_tree')) return true;
      if(t.id==='survive_night' && (S.phase==='journey'||S.phase==='finale')) return true;
      return false;
    });
    if(!known.length) body.innerHTML='<p style="opacity:.6">尚无进行中的任务。随着年龄与行程推进会解锁。</p>';
    else body.innerHTML = known.map(t=>{
      const st=S.tasks[t.id]||{};
      return `<div class="p-task${st.done?' done':''}"><b>${st.done?'[已完成]':'[进行中]'} ${t.name}</b><br>${t.desc}<br><span style="opacity:.6">奖励：经验×${t.exp}${t.max?` · 进度 ${st.prog||0}/${t.max}`:''}</span></div>`;
    }).join('');
  } else if(tab==='prof'){
    const ids = Object.keys(S.know).concat(Object.keys(S.love)).filter((v,i,a)=>a.indexOf(v)===i);
    if(!ids.length) body.innerHTML='<p style="opacity:.6">人物名录尚空。多与身旁角色交谈吧。</p>';
    else body.innerHTML = ids.map(id=>{
      const c=CHARS[id]||{short:id,name:id}; const k=S.know[id]||0; const l=S.love[id]||0;
      const hearts='♥'.repeat(l)+'♡'.repeat(5-l);
      const pf = resolvePortrait(id, 'normal') || PORTRAIT_FILES[`${id}_normal`];
      return `<div class="p-prof"><div class="av">${pf?`<img src="${pf}"/>`:(CSS_CHARS[id]?.[1]||'◇')}</div>
        <div class="info"><div class="nm">${c.name||c.short}</div>
        <div class="meta">${c.role||''} · 了解度 ${k}%</div>
        <div class="hearts">${hearts}</div>
        <div class="know-bar"><i style="width:${k}%"></i></div></div></div>`;
    }).join('');
  } else if(tab==='inv'){
    const slots = S.inv.map(it=>{
      const use = it.id==='cookie' ? `<button class="tbtn" style="margin-top:6px;min-width:0;padding:4px 12px;font-size:12px" data-use="${it.id}">食用</button>` : '';
      return `<div class="inv-slot filled">${it.icon||'◇'}<br>${it.name}<br><span style="opacity:.6">${it.desc||''}</span>${use}</div>`;
    }).join('');
    body.innerHTML=`<div class="p-inv">${slots || '<div class="inv-slot">空</div>'}</div>
      <p style="margin-top:8px;opacity:.6;font-size:12px">背包 ${S.inv.length}/50 · 系统收纳（单手可握之物）</p>`;
    setTimeout(()=>{
      $('panel-body').querySelectorAll('[data-use]').forEach(b=>{
        b.onclick=()=>useItem(b.getAttribute('data-use'));
      });
    },0);
  } else if(tab==='ach'){
    const unlocked = ACH.filter(a=>S.ach[a.id]);
    const lockedN = ACH.length - unlocked.length;
    body.innerHTML = (unlocked.length? unlocked.map(a=>`<div class="p-ach">✦ <b>${a.name}</b><br>${a.desc}<br><span style="opacity:.6">奖励：${a.reward}</span></div>`).join('') : '<p style="opacity:.6">尚未解锁成就。</p>')
      + (lockedN? `<p style="margin-top:12px;opacity:.5;font-size:12px">还有 ${lockedN} 个隐藏成就未解锁</p>` : '');
  } else if(tab==='saves'){
    const slots = loadManualSlots();
    const slotCards = [1, 2, 3, 4].map(id => {
      const s = slots[id];
      return `
        <div class="save-slot-card${s ? ' filled' : ''}">
          <div class="ssc-head">
            <span>手记槽位 0${id}</span>
            <small style="opacity:.7;font-weight:400">${s ? formatSlotTime(s.ts) : '空置'}</small>
          </div>
          <div class="ssc-meta">${s ? `${escapeText(s.label)}<br>${escapeText(s.date)} · ${escapeText(s.loc)}` : '可将当前旅途进度保存至此槽位，随时分支重返。'}</div>
          <div class="ssc-btns">
            <button type="button" class="tbtn" style="min-width:0;padding:5px 12px;font-size:12px" data-slot-save="${id}">存档</button>
            <button type="button" class="tbtn ghost" style="min-width:0;padding:5px 12px;font-size:12px" data-slot-load="${id}" ${s ? '' : 'disabled'}>读档</button>
            ${s ? `<button type="button" class="tbtn ghost" style="min-width:0;padding:5px 10px;font-size:12px" data-slot-del="${id}">清空</button>` : ''}
          </div>
        </div>
      `;
    }).join('');
    const chaps = getUnlockedChaptersList();
    const chapRows = chaps.map(ch => `
      <div class="chapter-replay-row">
        <div>
          <div class="crr-vol">${escapeText(ch.vol || '主线幕间')}</div>
          <div class="crr-title">${escapeText(ch.t || ch.title || ch.id)}</div>
        </div>
        <button type="button" class="tbtn ghost" style="min-width:0;padding:5px 14px;font-size:12px" data-replay-scene="${ch.id}">重温章节</button>
      </div>
    `).join('');
    body.innerHTML = `
      <h4 style="margin:0 0 10px;color:var(--gold-bright);font-size:14px">手动档案槽位</h4>
      <div class="save-slots-grid">${slotCards}</div>
      <h4 style="margin:18px 0 8px;color:var(--gold-bright);font-size:14px">已历章节重温</h4>
      <p style="font-size:12px;opacity:.7;margin-bottom:6px">仅开放已解锁经历的篇章（避免剧透未见章节）。建议重温前先存入上方手动槽位。</p>
      <div class="chapter-replay-list">${chapRows || '<p style="opacity:.6">尚无已完成的篇章。</p>'}</div>
    `;
    setTimeout(()=>{
      body.querySelectorAll('[data-slot-save]').forEach(b => { b.onclick = ()=> saveToManualSlot(b.getAttribute('data-slot-save')); });
      body.querySelectorAll('[data-slot-load]').forEach(b => { b.onclick = ()=> loadFromManualSlot(b.getAttribute('data-slot-load')); });
      body.querySelectorAll('[data-slot-del]').forEach(b => { b.onclick = ()=> deleteManualSlot(b.getAttribute('data-slot-del')); });
      body.querySelectorAll('[data-replay-scene]').forEach(b => {
        b.onclick = ()=>{
          const scId = b.getAttribute('data-replay-scene');
          if(!scId || !SCENES[scId]) return;
          show('panel', 0);
          runScene(scId);
        };
      });
    }, 0);
  } else if(tab==='settings'){
    const cur = getSettings();
    body.innerHTML = `<div class="p-stat" style="grid-template-columns:1fr">
      <div><b>BGM 音量</b></div>
      <input type="range" id="set-bgm" min="0" max="100" value="${Math.round(cur.bgm*100)}" style="width:100%">
      <div style="opacity:.7;font-size:12px">当前 ${Math.round(cur.bgm*100)}%</div>
      <div style="margin-top:14px"><b>背景明度</b></div>
      <input type="range" id="set-bright" min="50" max="150" value="${Math.round(cur.bright*100)}" style="width:100%">
      <div style="opacity:.7;font-size:12px">当前 ${Math.round(cur.bright*100)}%（100=默认）</div>
    </div>
    <button class="tbtn" id="set-reset" style="margin-top:18px">全部恢复默认</button>`;
    // 事件绑定
    setTimeout(()=>{
      const bm=$('set-bgm'); if(bm) bm.oninput=()=>{ setSetting('bgm', bm.value/100); };
      const br=$('set-bright'); if(br) br.oninput=()=>{ setSetting('bright', br.value/100); };
      const rs=$('set-reset'); if(rs) rs.onclick=()=>{ resetSettings(); openPanel('settings'); toast('已恢复默认设置'); };
    },0);
  }
}

// ========== 设置（音量/亮度等，持久化） ==========
const SETTINGS_KEY = 'ojousama_settings_v1';
function getSettings(){
  try { return Object.assign({bgm:0.5, bright:1}, JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')); }
  catch(e){ return {bgm:0.5, bright:1}; }
}
function setSetting(k, v){
  const s = getSettings(); s[k]=v;
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch(e){}
  // 只应用被改动的项：改亮度绝不触碰 bgm，避免滑动亮度时 BGM 反复淡入淡出卡顿
  if(k==='bgm'){ bgmSetVolume(v); bgmApplyMute(); }
  else if(k==='bright'){ applyBrightness(v); }
}
function resetSettings(){
  try { localStorage.removeItem(SETTINGS_KEY); } catch(e){}
  applySettings();
}
function applySettings(){
  const s = getSettings();
  bgmSetVolume(s.bgm); bgmApplyMute(); applyBrightness(s.bright);
}
function applyBrightness(v){
  const bg=$('bg'); if(bg) bg.style.filter = (v && v!==1) ? `brightness(${v})` : '';
}
$('btn-panel').onclick=()=>openPanel('status');
$('btn-panel-close').onclick=()=>show('panel',0);
if($('btn-stats')) $('btn-stats').onclick=()=>openStatsPanel();
if($('btn-stats-close')) $('btn-stats-close').onclick=()=>show('stats-overlay',0);


// ========== STORY GATES ==========
function checkStoryGates(options={}){
  const queue=[];
  const planned=new Set();
  const hasGate=key=>!!flag(key)||planned.has(key);
  const addGate=(key,condition,sceneId)=>{
    if(hasGate(key)||!condition) return false;
    planned.add(key);
    (Array.isArray(sceneId)?sceneId:[sceneId]).forEach(id=>queue.push(id));
    return true;
  };

  // 门控检查只建立播放队列，不提前写入“已完成”标记。
  addGate('ch_first_word', dateAtLeast(0,7), 's_first_word');
  addGate('ch_alice_born', dateAtLeast(2,6), 's_alice_born');
  addGate('ch_child_days', hasGate('ch_alice_born') && dateAtLeast(3,9), 's_child_days');
  addGate('ch_age4', dateAtLeast(4,3), 's_age4');
  addGate('ch_yaoshen', dateAtLeast(4,12), 's_yaoshen');
  addGate('ch_sisters_grow', dateAtLeast(5,6), 's_sisters_grow');
  addGate('ch_reno_arrive', dateAtLeast(6,3), 's_reno_arrive');
  addGate('ch_alice_affinity', dateAtLeast(7,3), 's_alice_affinity');
  addGate('ch_beatrice_day', dateAtLeast(7,12), 's_beatrice_day');
  addGate('ch_micro', dateAtLeast(8,6), 's_micro');
  addGate('ch_alice_wind', dateAtLeast(9,3), 's_alice_wind_teach');
  addGate('ch_beatrice_leaves', dateAtLeast(10,3), 's_beatrice_leaves');

  // 即使玩家跨过多个年份，也在同一队列里依次补齐学院篇，不再依赖旧 phase 值。
  const academyDue=dateAtLeast(12,3);
  addGate('ch_academy', academyDue, 's_academy_start');
  addGate('ch_opening_ceremony', academyDue, 's_opening_ceremony');
  addGate('met_noelle', academyDue, 's_noelle_meet');
  addGate('met_aino', academyDue, 's_aino_meet');
  addGate('met_charlotte', academyDue, 's_charlotte_meet');
  const academyTrack=S.phase==='academy'||hasGate('ch_academy');
  addGate('ch_helena', academyTrack && dateAtLeast(12,9), 's_helena');
  addGate('ch_aino_sparring', academyTrack && dateAtLeast(12,12), 's_aino_sparring');
  addGate('met_ajun', academyTrack && hasGate('ch_aino_sparring'), 's_ajun');
  addGate('ch_ice_melt_1', academyTrack && dateAtLeast(13,9), 's_ice_melt_1');
  addGate('ch_seven_mountains', academyTrack && dateAtLeast(13,12), 's_seven_mountains');
  addGate('ch_ice_melt_2', academyTrack && dateAtLeast(14,3), 's_ice_melt_2');
  addGate('ch_beach', academyTrack && dateAtLeast(14,6), 's_beach');
  addGate('ch_tree', academyTrack && dateAtLeast(15,3), 's_tree');
  addGate('ch_star', academyTrack && dateAtLeast(15,9), 's_star_festival');
  addGate('did_turnpoint', academyTrack && dateAtLeast(15,12), 's_turnpoint');

  const journeyTrack=S.phase==='journey'||S.phase==='finale'||hasGate('did_turnpoint');
  addGate('ch_black_name', journeyTrack && (!S.alias||S.alias!=='眷寒渔'||dateAtLeast(15,12)), 's_black_name');
  addGate('arrived_jikan', journeyTrack && hasGate('ch_black_name') && (S.dayCount>0||dateAtLeast(15,12)), 's_jikan_arrive');
  addGate('ch_north_forest', journeyTrack && hasGate('arrived_jikan') && dateAtLeast(16,3), 's_north_forest');
  addGate('ch_glow_sheep', journeyTrack && hasGate('ch_north_forest') && dateAtLeast(16,3), 's_glow_sheep');
  addGate('ch_distant_wind_1', journeyTrack && hasGate('ch_glow_sheep') && dateAtLeast(16,6), 's_distant_wind_1');
  addGate('ch_words_to_wind', journeyTrack && hasGate('ch_distant_wind_1') && dateAtLeast(16,6), 's_words_to_wind');
  addGate('ch_eye_of_storm', journeyTrack && hasGate('ch_words_to_wind') && dateAtLeast(16,9), 's_eye_of_storm');
  addGate('ch_leaky_cup', journeyTrack && hasGate('ch_eye_of_storm') && dateAtLeast(16,9), 's_leaky_cup');
  addGate('ch_distant_wind_2', journeyTrack && hasGate('ch_leaky_cup') && dateAtLeast(16,12), 's_distant_wind_2');

  const validQueue=queue.filter((id,index)=>SCENES[id] && queue.indexOf(id)===index);
  if(!validQueue.length) return false;
  if(options.defer){
    S.storyPending=validQueue.slice();
    save();
    return true;
  }
  runSceneQueue(validQueue,0);
  return true;
}
function resumePendingStories(){
  const pending=(Array.isArray(S.storyPending)?S.storyPending:[]).filter(id=>SCENES[id]);
  if(!pending.length){ S.storyPending=[]; return false; }
  runSceneQueue(pending,0);
  return true;
}
function runSceneQueue(queue, idx){
  const valid=(queue||[]).filter(id=>SCENES[id]);
  const start=clamp(idx||0,0,valid.length);
  if(start>=valid.length){ storyChain=null; S.storyPending=[]; save(); return false; }
  storyChain = { queue: valid, idx: start };
  S.storyPending=valid.slice(start);
  save();
  stepChain();
  return true;
}
function stepChain(){
  if(!storyChain) return;
  if(storyChain.idx >= storyChain.queue.length){
    storyChain = null;
    S.storyPending=[];
    save();
    return;
  }
  const currentIdx=storyChain.idx;
  const id = storyChain.queue[storyChain.idx++];
  const sc = SCENES[id];
  if(!sc){ stepChain(); return; }
  currentScene = id;
  if(typeof VNUx!=='undefined'&&VNUx.onSceneStart) VNUx.onSceneStart(id);
  S.storyPending=storyChain.queue.slice(currentIdx);
  resetDialogAdvanceState();
  S.freeRoam = false;
  awaitingChoice = false;
  show('action-bar', 0);
  const box = $('choices'); if(box) box.innerHTML = '';
  show('game-screen', 1);
  clearPortraits();          // 场景切换：重置立绘舞台
  if(sc.bg) setBG(sc.bg);
  bgmSceneStart(sc.bgm); // 记录并播放场景 bgm，贯穿整个场景
  if(sc.phase) S.phase = sc.phase;
  if(sc.loc){ S.loc = sc.loc; updateLocBar(); }
  updateHUD();
  // 「视角」演出：pov 场景隐藏顶部 HUD（如贝阿特丽丝大人的一天，以贝蒂视角叙述）
  if(sc.pov) setPov(true);
  const go = ()=> playLines(sc.lines || [], ()=>{
    // 只有场景确实播放结束，才写入对应的“已完成”门控标记。
    markStoryGateCompleted(id);
    if(storyChain && storyChain.idx < storyChain.queue.length){ stepChain(); }
    else { storyChain = null; enterFreeRoam(); }
  });
  if(sc.card) showCard(sc.card.vol, sc.card.t, sc.card.s, go);
  else go();
  save();
}

// ========== SCENES ==========
const SCENES = {};
function runScene(id){
  if(currentScene && currentScene!==id) markStoryGateCompleted(currentScene);
  storyChain = null;
  S.storyPending=[id];
  const sc = SCENES[id];
  if(!sc){ console.warn('missing scene', id); toast('剧情缺失：'+id); enterFreeRoam(); return; }
  currentScene = id;
  if(typeof VNUx!=='undefined'&&VNUx.onSceneStart) VNUx.onSceneStart(id);
  resetDialogAdvanceState();
  S.freeRoam = false;
  awaitingChoice = false;
  show('action-bar', 0);
  const box = $('choices'); if(box) box.innerHTML = '';
  show('game-screen', 1);
  clearPortraits();          // 场景切换：重置立绘舞台
  if(sc.bg) setBG(sc.bg);
  bgmSceneStart(sc.bgm); // 记录并播放场景 bgm，贯穿整个场景
  if(sc.phase) S.phase = sc.phase;
  if(sc.loc){ S.loc = sc.loc; updateLocBar(); }
  updateHUD();
  // 「视角」演出：pov 场景隐藏顶部 HUD（如贝阿特丽丝大人的一天，以贝蒂视角叙述）
  if(sc.pov) setPov(true);
  const go = ()=> playLines(sc.lines || [], sc.done);
  if(sc.card) showCard(sc.card.vol, sc.card.t, sc.card.s, go);
  else go();
  save();
}

// ----- PROLOGUE -----
// ※ 旧版 s_start 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_first_word 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_alice_born 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_yaoshen 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// childhood hub trigger for first word
// ※ 旧版 s_child_hub 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ===== 三姐妹的岁月 (5岁) =====
// ※ 旧版 s_sisters_grow 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ===== 遇见雷纳德叔叔 (6岁) =====
SCENES.s_reno_arrive = {
  bgm:'cheerful', bg:'bg-img-dining bg-hall', loc:'dining', phase:'youth',
  card:{vol:'第一卷', t:'第四章', s:'浪人叔叔'},
  lines:[
    // —— 开场：旁白，餐厅 ——
    {text:'六岁。', loc:'dining', bg:'bg-img-dining bg-hall'},
    {text:'传说中那个"离家出走"的叔叔回来了。我小时候模模糊糊见过他两三面，听说他还和阿斯拉魔法大学的校长法神从前是同学。'},
    {text:'雷纳德·维斯特利亚，我父亲的弟弟。比起总是板着脸、威严满满的父亲，这位叔叔简直像是另一个物种。'},
    // —— 雷纳德登场：立绘高亮 ——
    {ch:'reno', speaker:'雷纳德', text:'惊喜！我回来啦！'},
    {text:'他风尘仆仆地出现在餐厅门口，背着个巨大的包裹，靴子上全是泥巴，笑得像个没心没肺的大孩子。', portraits:[{id:'reno', slot:'left', active:false}]},
    {text:'父亲扶额叹气，母亲笑着摇头，只有贝阿特丽丝姐姐冲上去给了他一拳——当然没打中。', portraits:[{id:'reno', slot:'left', active:false}]},
    {text:'叔叔在家里住了半个月，我也终于明白了为什么法神大人会是他的同学——这人虽然看着不正经，但魔法造诣很高。', portraits:[{id:'reno', slot:'left', active:false}]},
    // —— 讲故事桥段：爱丽丝出现并提问（高亮爱丽丝） ——
    {text:'当然，他主要的作用还是讲故事。'},
    {ch:'reno', speaker:'雷纳德', text:'驰弩帝国北边的森林里，有一种雪狼，大概有这么大——全身雪白，跑起来像一团滚动的雪球！'},
    {text:'贝阿特丽丝姐姐听得两眼放光，恨不得立刻提剑去北边。爱丽丝则安静地坐在我旁边，偶尔问几个问题。', portraits:[{id:'reno', slot:'left', active:false},{id:'alice', slot:'right', active:false}]},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……那里的风大吗？暴风雪会持续多久？'},
    {text:'问题虽然有点偏，但叔叔很高兴有人对细节感兴趣，讲得更起劲了。', portraits:[{id:'reno', slot:'left', active:false},{id:'alice', slot:'right', active:false}]},
    // —— 转夜晚房间：剧情事件转换，回收立绘 ——
    {bg:'bg-img-nursery bg-room', loc:'nursery', portraits:[], text:'某天晚上，叔叔溜进我房间，检查了我的魔法进度。'},
    // —— 主角与雷纳德单独交谈：双人立绘，说话者高亮 ——
    {text:'看完我的冰晶术后，他收起了那副嬉皮笑脸的表情。'},
    {portraits:[{id:'reno', slot:'left', active:true},{id:'sylvia', slot:'right', active:false}], speaker:'雷纳德', text:'六岁能控制到这个程度，咱们家这是出了个小怪物啊。等你以后去了魔法大学，要是有人欺负你，就报我名字。'},
    {portraits:[{id:'reno', slot:'left', active:false},{id:'sylvia', slot:'right', active:true}], speaker:'希尔维亚', text:'报了有用吗？'},
    {portraits:[{id:'reno', slot:'left', active:true},{id:'sylvia', slot:'right', active:false}], speaker:'雷纳德', text:'大概有用吧……只要法神大人忘掉了我欠她钱的事。'},
    // —— 结尾主角心理：主角高亮 ——
    {text:'看来以后还是尽量别报他的名字比较好。', portraits:[{id:'sylvia', slot:'center', active:true}], know:'reno', knowD:20, freeRoam:true},
  ]
};


// ===== 爱丽丝亲和测试 (7岁) =====
// ※ 旧版 s_alice_affinity 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

SCENES.s_beatrice_leaves = {
  bgm:'peaceful', bg:'bg-img-hallway bg-hall', phase:'youth',
  lines:[
    {text:'十岁。姐姐要去魔法大学了。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'希尔维亚！姐姐要出发了！等我到了大学，一定把所有好玩的事都写信告诉你！'},
    {ch:'sophia', speaker:'索菲亚', text:'贝阿特丽丝，路上小心。'},
    {ch:'claude', speaker:'克劳德', text:'到了学校好好学习。别光顾着玩。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'知道啦知道啦！我可是贝阿特丽丝大人！一定会成为全校最厉害的！'},
    {text:'姐姐在门口挥了挥手，跳上了马车。金色的头发在阳光下闪闪发亮。'},
    {text:'马车走远了。门口变得安静。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……姐姐大人。贝阿特丽丝姐姐走了。'},
    {text:'嗯。两年后我们也会去。'},
    {ch:'alice', speaker:'爱丽丝', text:'……嗯。'},
    {text:'公爵府安静了一些。少了那个大嗓门，走廊好像变长了。', freeRoam:true}
  ]
};

// ----- ACADEMY -----
// ※ 旧版 s_academy_start 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_noelle_meet 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_charlotte_meet 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

SCENES.s_huke = {
  bgm:'cheerful', bg:'bg-img-town bg-town', phase:'academy',
  lines:[
    {text:'王都材料市场。三条街的药草与矿石味。', task:'market_walk'},
    {text:'巷口——三个初级冒险者围着一个小男孩。'},
    {speaker:'虎克', text:'放开！这是我爹采的！'},
    {text:'银发在阳光下很显眼。我走近。空气骤降。他们的靴底结冰。'},
    {speaker:'希尔维亚', text:'希尔维亚·维斯特利亚。东西，还给他。'},
    {text:'他们跑了。比抢东西时还快。'},
    {ch:'huke', speaker:'虎克', text:'谢谢姐姐……我叫虎克。姐姐在魔法大学，叫诺艾儿！成绩第一名！', know:'huke', knowD:40, task:'lost_child', flag:'met_huke'},
    {text:'琥珀色的眼睛。硬气却在抖。和某人一个模子。'},
    {text:'我送他回摊位。又去书店买了两本书——一本给诺艾儿，一本给虎克。'},
    {text:'三十银。他们家大半年的收入。\n至少书这种东西，我能给。', gold:-30, love:'noelle', loveD:1, freeRoam:true}
  ]
};

// ----- JOURNEY -----
SCENES.s_turnpoint = {
  bgm:'sad', bg:'bg-night', phase:'finale',
  card:{vol:'第一卷', t:'转折点（一）', s:'——'},
  lines:[
    {do:()=>{ S.ageY=Math.max(S.ageY,15); syncStatsToAge(); }},
    {text:'十五岁的冬天。寒假。公爵府。\n雷纳德叔叔背着大包风尘仆仆出现在餐厅门口，靴子上全是泥，笑得像没心没肺的大孩子。'},
    {ch:'reno', speaker:'雷纳德', text:'惊喜！我回来啦！'},
    {text:'父亲扶额，母亲笑着摇头，贝蒂冲上去给了他一拳（没打中）。'},
    {text:'六个人坐在一张桌子上。姐姐的论文改完了——「十八遍！贝阿特丽丝大人的旷世巨著！」\n一切都很好。'},
    {text:'我躺在床上。枕头很软。'},
    {sfx:'bad', text:'碎裂声。不是玻璃——是石头。从大门方向。', portraits: []},
    {ch:'claude', speaker:'克劳德', text:'穿鞋。'},
    {text:'父亲的脸上是一种我从没见过的东西。把所有情绪削掉后的骨架。'},
    {ch:'sophia', speaker:'索菲亚', text:'（白色法杖。霜杉木簪。看了我一眼。点头。）'},
    {text:'密道。储藏室第三排砖。墙壁裂开。'},
    {speaker:'克劳德', text:'直走，不拐弯，不停。出去往东。不要回学院。不要去认识你的人那里。'},
    {speaker:'希尔维亚', text:'你们——'},
    {speaker:'克劳德', text:'我们随后来。'},
    {text:'他在说谎。我知道。他知道我知道。'},
    {ch:'sophia', speaker:'索菲亚', text:'长高了。'},
    {text:'母亲把我额前的碎发拨到耳后。和小时候一模一样。'},
    {speaker:'索菲亚', text:'走。'},
    {text:'墙壁合上。暗红与银白的光在缝隙里交织。最后一眼——很快，不盯着就会错过。'},
    // ===== 以下，希尔维亚·维斯特利亚无从知晓。 =====
    // —— 西翼：父母迎战 ——
    {cg:'parents_battle.jpg', text:'以下，希尔维亚·维斯特利亚无从知晓。'},
    {cg:'parents_battle.jpg', text:'公爵府西翼。克劳德·维斯特利亚看着墙壁合拢的最后一刻，确认女儿的身影消失在黑暗中。他没有回头。'},
    {cg:'parents_battle.jpg', ch:'sophia', speaker:'索菲亚', text:'多少人？'},
    {cg:'parents_battle.jpg', ch:'claude', speaker:'克劳德', text:'前厅方向至少三队。东翼方向也有。是分头来的。'},
    {cg:'parents_battle.jpg', ch:'sophia', speaker:'索菲亚', text:'雷纳德那边——'},
    {cg:'parents_battle.jpg', ch:'claude', speaker:'克劳德', text:'他撑得住。'},
    {cg:'parents_battle.jpg', text:'克劳德踏出一步。短杖不是杖。是武器。走廊炸开了。'},
    {cg:'parents_battle.jpg', text:'战斗持续了很长时间。西翼的走廊被打得面目全非。两个人守住一条线，给女儿多争一点时间。'},
    // —— 东翼：贝蒂带爱丽丝逃入死路 ——
    {cg:'beatrice_battle.png', text:'公爵府东翼。贝阿特丽丝冲向爱丽丝的房间。'},
    {cg:'beatrice_battle.png', text:'前面封了。后面在追。十七岁的贝阿特丽丝·维斯特利亚站在仆人通道里，前后都是死路。'},
    {cg:'beatrice_battle.png', ch:'beatrice', speaker:'贝阿特丽丝', text:'我带你们走。仆人道尽头有排水渠口，钻过去能出城。'},
    {cg:'beatrice_battle.png', ch:'beatrice', speaker:'贝阿特丽丝', text:'我在这里挡一下。'},
    // —— 贝蒂与爱丽丝死别 ——
    {cg:'parting.png', ch:'alice', speaker:'爱丽丝', text:'不要。'},
    {cg:'parting.png', ch:'beatrice', speaker:'贝阿特丽丝', text:'没事。上个月突破高级了。挡一会儿还是能挡的。'},
    {cg:'parting.png', ch:'alice', speaker:'爱丽丝', text:'你骗人——'},
    {cg:'parting.png', ch:'beatrice', speaker:'贝阿特丽丝', text:'我的妹妹才是真正的天才，爱丽丝。你比我聪明。你更值得——'},
    {cg:'parting.png', ch:'beatrice', speaker:'贝阿特丽丝', text:'听好了。听贝阿特丽丝大人的话。'},
    {cg:'parting.png', ch:'beatrice', speaker:'贝阿特丽丝', text:'你不要管我。你跑。跑得越远越好。然后——找到希尔维亚。'},
    {cg:'parting.png', text:'火焰从她的右手倾泻而出。整条通道化作了一道灼热的咽喉。贝阿特丽丝站在火焰最中心，金色的头发在火光中像太阳。'},
    // —— 十字路口：雷纳德地形拖敌 ——
    {cg:'reno_battle.jpg', text:'东翼和主走廊之间的十字路口。雷纳德·维斯特利亚站在路口正中间。一个人。没有武器。'},
    {cg:'reno_battle.jpg', text:'地面开始变形。石板翘起、碎裂、重组。四条走廊在几秒钟之内变成了一座简陋但有效的迷宫。'},
    {cg:'reno_battle.jpg', text:'他不是在杀人。是在绊脚、困人、拖延。每多撑一分钟，侄女们就多跑出一段。'},
    // —— 帝级 ——
    {cg:'reno_diji.jpg', text:'墙被一拳打穿了。一个帝级。'},
    {cg:'reno_diji.jpg', ch:'reno', speaker:'雷纳德', text:'……贝尔蒙家的私军。'},
    {cg:'reno_diji.jpg', text:'帝级的拳头穿透石墙，碎石擦过他的太阳穴。第二拳到了。胸口。'},
    {cg:'reno_diji.jpg', text:'他滑坐在地上，嘴里有铁锈味。他在数。从第一声碎响到现在——大概二十五分钟。应该够了。'},
    {cg:'reno_diji.jpg', text:'雷纳德·维斯特利亚靠在墙根，闭上了眼。'},
    // ===== 以上，希尔维亚·维斯特利亚无从知晓。 =====
    {cg:'end', bg:'bg-img-forest bg-forest', text:'以上，希尔维亚·维斯特利亚无从知晓。'},
    {text:'我在跑。密道很长。出口是冬夜的林地。'},
    {text:'回头。公爵府方向的天空有一片不正常的橘色。\n是火光。', task:'survive_night', ach:'black_hair'},
    {text:'往东。不拐弯。不停。先活下来。'},
    {do:()=>{ S.alias='眷寒渔'; S.phase='journey'; ['road','jikan','chenglan_guild','northforest'].forEach(id=>{if(LOCS[id])LOCS[id].unlock=true;}); S.loc='road'; }},
    {text:'（第三卷 旅途篇。以「眷寒渔」之名前行。可前往澄岚镇霁馆。）', freeRoam:true}
  ]
};

// ※ 旧版 s_jikan_arrive 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）


// ----- more childhood / youth -----
// ※「魔力初感 / 勇者之赐」旧版场景已删除：内容已并入 js/story.js 的 s_child_days（3年9月）

SCENES.s_tier1_story = {
  bgm:'sacred', bg:'bg-pick',
  lines:[
    {text:'世界静止了。窗帘凝固，虫鸣消失。'},
    {text:'「勇者之赐」——最高阶段首次提升。'},
    {text:'七个选项。未选者永久消失。'},
    {pickTier:1},
  ]
};

// ※ 旧版 s_alice_talk（爱丽丝念绘本）已删除：内容已并入 s_child_days（3年9月）

// ※ 旧版 s_micro 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

SCENES.s_beach = {
  bgm:'cheerful', bg:'bg-img-beach bg-beach', loc:'beach', phase:'academy',
  card:{vol:'第一卷', t:'第七章', s:'海与贝壳'},
  lines:[
    {text:'暑假。姐姐在马车上睡着了，嘴角还挂着果酱渍。'},
    {text:'到了。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'大海！！'},
    {text:'马车在别墅门前停稳的瞬间，姐姐"嗖"地弹起来，像一只装了弹簧的金毛犬。'},
    {text:'别墅门口站着三个人。父亲穿着难得一见的休闲衬衫。母亲笑着朝我们挥手。'},
    {text:'然后是妹妹。'},
    {text:'爱丽丝站在母亲身侧，白色的长发被海风轻轻吹起。浅蓝色的连衣裙，双手安静地交叠在身前，表情是一贯的淡然。'},
    {text:'看到我们下车，她的睫毛颤了一下。然后她走过来。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……姐姐大人，路上辛苦了。'},
    {text:'然后她张开手臂，抱住了我。'},
    {text:'力气一点也不"客气"。她的额头埋进我的肩窝，手臂紧紧箍住我的腰，整个人像一块磁铁"咔"地吸了上来。'},
    {text:'心跳。很快。不是我的，是她的。隔着薄薄的夏装，一下一下，又急又密。'},
    {speaker:'希尔维亚', text:'……嗯，我回来了。'},
    {text:'我伸手摸了摸她的头发。她蹭了一下我的肩膀。'},
    {text:'然后——松手。退后半步。双手重新交叠在身前。表情恢复淡然。'},
    {text:'整个过程前后不超过五秒。'},
    {text:'◇'},
    {text:'行李搬进房间后，我在客厅目睹了一场精彩的夫妻攻防战。'},
    {text:'父亲坐在沙发上，眼神反复飘向书房方向——那表情，像一只被人把狗粮锁进柜子的大型犬。'},
    {ch:'sophia', speaker:'索菲亚', text:'你父亲出发前偷偷把公文塞进了行李箱夹层。我发现了，锁进了书房的柜子里。柜子上了魔力锁，只要你父亲的手碰到锁面，就会触发警报。'},
    {ch:'sophia', speaker:'索菲亚', text:'会响遍整栋别墅的那种哦。'},
    {text:'公爵大人正襟危坐，双手规规矩矩地放在膝盖上，脊背挺得笔直。'},
    {ch:'claude', speaker:'克劳德', text:'索菲亚，巴依国的邦交文书——'},
    {ch:'sophia', speaker:'索菲亚', text:'你写完了。'},
    {ch:'claude', speaker:'克劳德', text:'驰驽帝国的使节下个月就到——'},
    {ch:'sophia', speaker:'索菲亚', text:'有副官在。'},
    {ch:'claude', speaker:'克劳德', text:'就看一份备忘——'},
    {ch:'sophia', speaker:'索菲亚', text:'克劳德。'},
    {text:'母亲连"大人"都省了，直接喊名字。'},
    {text:'父亲闭上了嘴。识时务者为公爵。投降速度：零点三秒。'},
    {text:'◇'},
    {text:'下午，换泳装去海边。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'怎么样！贝阿特丽丝大人的泳装秀！打分！满分十分！'},
    {speaker:'希尔维亚', text:'六分。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'为什么只有六分！！'},
    {speaker:'希尔维亚', text:'冲浪板拿反了，扣两分。果酱渍还没擦，扣两分。'},
    {text:'姐姐在浅水区蹦蹦跳跳地踩着浪，玩得不亦乐乎。'},
    {text:'我找了块阴凉坐下，释放一缕冰霜之息给周围降温。妹妹蹭过来，靠在我旁边翻开书。'},
    {text:'姐姐堆沙堡——成品像一坨被踩过的布丁。然后发现了一只寄居蟹，追着它满沙滩跑了三圈。'},
    {ch:'alice', speaker:'爱丽丝', text:'……贝阿特丽丝姐姐跑的路线是圆形的。寄居蟹跑的路线也是圆形的。她们在绕同一个圈。'},
    {text:'还真是。'},
    {text:'◇'},
    {text:'接下来几天，日子过得很悠闲。除了一件事。'},
    {text:'姐姐每天下午四点消失，六点回来。精准得像上下班打卡。'},
    {text:'回来时头发是乱的，呼吸比平时快，脸颊泛红，手臂和小腿上有红印。但她看起来很高兴。'},
    {text:'每次回来第一件事就是冲进洗手间照镜子，一边照一边傻笑。'},
    {ch:'alice', speaker:'爱丽丝', text:'……姐姐，可能有心上人了。每天固定时间消失，不想让人知道。回来时头发乱、呼吸快、脸上带红晕、还会照镜子傻笑。'},
    {ch:'alice', speaker:'爱丽丝', text:'……这些特征加在一起，最符合的假设就是——在和某个人约会。'},
    {text:'姐姐？恋爱？贝阿特丽丝·维斯特利亚？那个追寄居蟹追三圈的贝阿特丽丝？'},
    {ch:'alice', speaker:'爱丽丝', text:'……明天下午，我们跟去看看。'},
    {text:'◇'},
    {text:'第五天，下午。我们跟踪姐姐穿过小镇东区，绕过码头边一排废弃仓库，来到了一片偏僻的海滩。'},
    {text:'姐姐站在礁石旁边。和她站在一起的不是什么"心上人"——是一个老奶奶。'},
    {text:'渔民。少说六十往上。'},
    {text:'姐姐脱掉了外面的罩衫——里面穿着泳衣——跟着老奶奶走进了水里。'},
    {text:'扑腾了两下。呛了。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'咳咳咳——好咸！！'},
    {text:'所以。姐姐不会游泳。'},
    {text:'贝阿特丽丝·维斯特利亚，十五岁，火系中级魔法师，自封"妹妹保镖"。找了个渔村老奶奶当教练，偷偷学游泳。'},
    {text:'身上的红印是礁石磕的。头发乱是泡了海水。呼吸快是体力消耗。而照镜子傻笑——大概是觉得自己又进步了一点。'},
    {text:'不是约会。不是心上人。是这个笨蛋在学游泳。'},
    {text:'姐姐发现了我们。她的表情以肉眼可见的速度经历了震惊→恐慌→窘迫→崩溃四个阶段。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'哼！看到就看到了！我只是觉得游泳是贵族基本功！——就是为了能自己潜到深水区嘛！那边的礁石缝里有月虹螺！！'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'我想亲手捞上来给爱丽丝做入学礼物！！买的谁不会买啊我就是想亲手——'},
    {text:'话说到一半。她愣住了。嘴还张着，但声音没了。'},
    {text:'月虹螺。深水区。亲手捞。给妹妹。做入学礼物。她全说了。'},
    {ch:'beatrice', emo:'sad', speaker:'贝阿特丽丝', text:'……本来想在你入学那天给你惊喜的。……结果我连游泳都不会。练了快一个星期，连深水区的边都摸不到。……'},
    {ch:'beatrice', emo:'sad', speaker:'贝阿特丽丝', text:'……我是不是很笨？连给妹妹准备个入学礼物都做不好……明明是姐姐……什么都做不好。'},
    {text:'她眼眶红红的。嘴唇在发抖。'},
    {text:'我走进水里。海水凉凉的，没过膝盖。'},
    {speaker:'希尔维亚', text:'你确实挺笨的。追寄居蟹追三圈那种笨。堆沙堡把自己金库踩塌了那种笨。微服私行花了不知道多少金币那种笨。'},
    {ch:'beatrice', emo:'sad', speaker:'贝阿特丽丝', text:'你还提那个！！'},
    {speaker:'希尔维亚', text:'但是——'},
    {text:'我伸手，把她肩上那条海藻拿掉了。'},
    {speaker:'希尔维亚', text:'——这种笨蛋姐姐，就是全天下最让人喜欢的姐姐。'},
    {text:'妹妹不知道什么时候也走进了水里。她走到姐姐面前，仰起头。'},
    {ch:'alice', emo:'happy', speaker:'爱丽丝', text:'……贝阿特丽丝姐姐。谢谢。……不管最后做不做得出来，谢谢你想为我做这些。……但是比起礼物——我更想和姐姐们一起待着。'},
    {ch:'alice', emo:'happy', speaker:'爱丽丝', text:'一起捞贝壳也好。一起呛水也好。一起被老奶奶骂也好。……只要是一起的，就是最好的礼物。'},
    {text:'姐姐盯着她看了三秒。然后嘴巴一瘪，眼泪终于掉下来了。'},
    {ch:'beatrice', emo:'sad', speaker:'贝阿特丽丝', text:'你们两个——你们两个——'},
    {text:'她一把把我和妹妹搂进怀里。湿淋淋的、咸兮兮的、黏糊糊的拥抱。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'好！既然都知道了！那就一起捞！三个人总比一个人快！'},
    {speaker:'希尔维亚', text:'我可以用冰魔法在水下开路。'},
    {ch:'alice', speaker:'爱丽丝', text:'……我可以用风魔法辅助呼吸。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'你们两个作弊了吧？？'},
    {speaker:'希尔维亚', text:'论作弊，不会游泳硬要潜深水区的那个人赢了。'},
    {text:'老奶奶在岸上摇头，嘟囔了一句"城里人真会整"，拿起鱼竿走了。'},
    {text:'接下来一个小时，我们在礁石区折腾得天翻地覆。一共找了十二颗月虹螺。'},
    {text:'晚上，一家人围在客厅大桌前做饰品。'},
    {text:'我做了一枚胸针。妹妹做了一对耳坠。姐姐做了一条手链——蝴蝶结歪歪扭扭的，她坚持说那是"不对称美学"。'},
    {text:'妹妹没把耳坠留给自己。一只递给姐姐，一只递给我。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……一人一只。分开戴，但还是一对。'},
    {text:'她从口袋里掏出一条用沙滩上随手捡的白色碎贝壳串成的手绳，绑在自己手腕上。'},
    {ch:'alice', speaker:'爱丽丝', text:'……因为是和姐姐们一起捡的。……所以比什么都贵重。'},
    {text:'姐姐的眼眶又红了。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'谁哭了！！是风！！'},
    {ch:'alice', speaker:'爱丽丝', text:'……屋里没风。'},
    {text:'十三岁的暑假。大海、贝壳、笨得可爱的姐姐、和太过聪明的妹妹。真好。', ach:'shell_gift', love:'beatrice', loveD:1},
    {do:()=>love('alice',1)},
    {item:{id:'shell_pin', name:'月虹螺胸针', icon:'🐚', desc:'三姐妹一起捞的。'}, freeRoam:true}
  ]
};

SCENES.s_star_festival = {
  bgm:'relax', bg:'bg-night', phase:'academy',
  card:{vol:'第二卷', t:'第九章', s:'并肩的树 · 星辰祭'},
  lines:[
    {text:'星辰祭。六年一次。家长开放日。'},
    {text:'广场上——深蓝色粗布外套，扣到最上一颗。霜杉木簪。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'是爸妈吧？！'},
    {text:'姐姐一头撞进父亲怀里。母亲理了理爱丽丝额前的碎发。'},
    {text:'她的睫毛颤了一下。手在裙子侧面攥紧又松开。'},
    {ch:'sophia', speaker:'索菲亚', text:'长高了。'},
    {text:'银杏林。不到两个小时。歪歪扭扭的银杏叶被母亲夹进袖口。'},
    {text:'上街。套圈。歪眼兔子。烟花在钟楼露台炸开。'},
    {text:'冰系那一发碎成雪。妹妹在笑。真的在笑。'},
    {ch:'beatrice', emo:'normal', speaker:'贝阿特丽丝', text:'我打算五年级毕业。外交官换届……我想自己来。'},
    {text:'雨。杂货铺。夏洛特独自坐在角落。'},
    {ch:'charlotte', speaker:'夏洛特', text:'你父母来了。便装。偷偷来。'},
    {text:'该来的人没来。来的是外务管事。'},
    {speaker:'希尔维亚', text:'你母亲种的那棵树，在你的照顾下真的长得很好。'},
    {ch:'charlotte', speaker:'夏洛特', text:'别跟任何人说。下次浇水别漫到我那边。'},
    {text:'「滚。」她说。但薄荷茶是热的。', know:'charlotte', knowD:15, love:'charlotte', loveD:1, flag:'ch_star', freeRoam:true}
  ]
};

// ※ 旧版 s_tree 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_helena 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_ajun 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// 初遇艾诺（第二章 同龄人：冰系课堂基本课 → 艾诺门口拦住）
// ※ 旧版 s_aino_meet 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// 与艾诺比试（第四章 距离：冰墙术 → 花坊 → 食堂 → 比试）
// ※ 旧版 s_aino_sparring 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// ※ 旧版 s_black_name 已删除（与 js/story.js 中的新版重复，新版会覆盖旧版）

// endings
// endings
// ending system removed

// ========== STORY CMD FROM ROAM ==========
function tryStoryAction(){
  // first word now auto-triggers via checkStoryGates
  if(S.phase==='academy' && (S.love.noelle||0)>=1 && !flag('unlocked_clock')){
    flag('unlocked_clock',1); LOCS.clocktower.unlock=true; LOCS.flowerhouse.unlock=true; LOCS.memorial.unlock=true;
  }
  if(S.phase==='journey' && S.loc==='road' && !flag('arrived_jikan') && S.dayCount>0){
    // arrived_jikan now auto-triggers via checkStoryGates
  }
  return false;
}

// story hooks after ambient freeRoam is fine via tryStoryAction on map/actions
var _enterLocRaw = enterLoc;
enterLoc = function(id){
  _enterLocRaw(id);
  // delay story so egg/ambient playLines can start first; only if still free
  setTimeout(()=>{
    if(S.freeRoam && !typing && !awaitingChoice) tryStoryAction();
  }, 200);
};

// ========== TITLE / BOOT ==========
function openLetterDemo(){
  const demo=$('letter-demo');
  if(!demo) return false;
  demo.classList.remove('hidden','playing','revealed');
  demo.setAttribute('aria-hidden','false');
  // 强制回流，让每次从标题页打开时都能从封蜡完整重播。
  void demo.offsetWidth;
  demo.classList.add('playing');
  sfx('page');
  return true;
}
function revealLetterDemo(){
  const demo=$('letter-demo');
  if(!demo || demo.classList.contains('hidden')) return false;
  demo.classList.remove('playing');
  demo.classList.add('revealed');
  return true;
}
function closeLetterDemo(){
  const demo=$('letter-demo');
  if(!demo) return false;
  demo.classList.add('hidden');
  demo.classList.remove('playing','revealed');
  demo.setAttribute('aria-hidden','true');
  const btn=$('btn-letter-test');
  if(btn && typeof btn.focus==='function') btn.focus();
  return true;
}
function bindLetterDemo(){
  const demo=$('letter-demo');
  const openBtn=$('btn-letter-test');
  const closeBtn=$('letter-close');
  if(!demo || !openBtn || !closeBtn) return;

  openBtn.onclick=()=>openLetterDemo();
  closeBtn.onclick=e=>{
    if(e && typeof e.stopPropagation==='function') e.stopPropagation();
    closeLetterDemo();
  };
  demo.onclick=e=>{
    if(e.target.closest && e.target.closest('#letter-close')) return;
    if(demo.classList.contains('revealed')) closeLetterDemo();
    else revealLetterDemo();
  };

  const paper=demo.querySelector('.alice-letter');
  if(paper) paper.addEventListener('animationend',e=>{
    if(e.animationName==='letter-paper-rise') revealLetterDemo();
  });
}
bindLetterDemo();

function newGame(){
  S=baseState();
  BACKLOG_LOG.length = 0;
  document.body.classList.remove('ai-drawer-open', 'roam');
  S.season = seasonOf(S.month);
  if(typeof VNUx!=='undefined'&&VNUx.clearBacklog) VNUx.clearBacklog();
  Object.values(LOCS).forEach(L=>{ if(L.area==='公爵府' && ['nursery','hallway','parlor','garden','dining'].includes(L.id)) L.unlock=true; });
  bgmUnlock(); // 用户点击开始 → 解锁音频
  show('title-screen',0); show('game-screen',1);
  runScene('s_start');
}
function continueGame(){
  if(!load()){ toast('没有存档'); return; }
  document.body.classList.remove('ai-drawer-open');
  bgmUnlock(); // 用户点击继续 → 解锁音频
  // re-unlock locs by phase
  Object.values(LOCS).forEach(L=>{
    if(L.area==='公爵府') L.unlock=true;
    if(S.phase==='academy'||S.phase==='journey'||S.phase==='finale'){
      if(L.area==='魔法大学') L.unlock=true;
    }
    if(S.phase==='journey'||S.phase==='finale'){
      if(['road','jikan','chenglan_guild','northforest','town','market'].includes(L.id)) L.unlock=true;
      if(flag('ch_distant_wind_2') && L.id==='ice_canyon') L.unlock=true;
    }
  });
  show('title-screen',0); show('game-screen',1);
  updateHUD(); updateLocBar();
  // 先恢复被刷新中断的剧情；旧存档则重新检查并补播已到期剧情。
  if(resumePendingStories()) return;
  if(checkStoryGates()) return;
  if(S.freeRoam) enterFreeRoam();
  else playLines([{text:`（读取存档）${dateStr()} · ${LOCS[S.loc]?.name||''}`, freeRoam:true}]);
}

function syncMuteBtn(){
  const b = $('btn-mute');
  if(b) b.classList.toggle('is-muted', !!(muted||bgmMuted));
}

$('btn-new').onclick=()=>{ sfx('click'); newGame(); };
$('btn-continue').onclick=()=>{ sfx('click'); continueGame(); };
$('btn-title').onclick=()=>{
  save();
  if(typeof AIChatPanel !== 'undefined' && AIChatPanel.closeDrawer) AIChatPanel.closeDrawer({ wipePending: true });
  if(typeof CombatEngine !== 'undefined' && CombatEngine.exitBattle) CombatEngine.exitBattle(false, { silent: true });
  document.body.classList.remove('ai-drawer-open', 'roam');
  show('game-screen',0); show('battle-screen',0); show('arena-overlay',0); show('panel',0); show('map-overlay',0); show('stats-overlay',0); show('backlog-overlay',0); show('title-screen',1);
  if(typeof VNUx !== 'undefined'){
    if(VNUx.setAutoMode) VNUx.setAutoMode(false);
    if(VNUx.setSkipMode) VNUx.setSkipMode(false);
  }
  updateHUD();
  if(typeof startTitleSnowLoop === 'function') startTitleSnowLoop();
};
$('btn-mute').onclick=()=>{
  muted=!muted;
  try { localStorage.setItem(MUTE_KEY, muted?'1':'0'); } catch(e){}
  bgmSetMuted(muted); // 静音同时作用于音效与 BGM
  syncMuteBtn();
};
$('btn-help').onclick=()=>show('help-screen',1);
$('btn-help-close').onclick=()=>show('help-screen',0);
if($('btn-backlog')) $('btn-backlog').onclick=e=>{ if(e && e.stopPropagation) e.stopPropagation(); if(typeof VNUx!=='undefined'&&VNUx.toggleBacklogModal) VNUx.toggleBacklogModal(); else openBacklog(); };
if($('btn-backlog-close')) $('btn-backlog-close').onclick=()=>show('backlog-overlay',0);
document.querySelectorAll('.modal-close-x[data-close-overlay]').forEach(btn=>{
  btn.onclick = ()=>{
    const id = btn.getAttribute('data-close-overlay');
    if(id) show(id, 0);
  };
});
$('btn-codex').onclick=()=>{
  if(typeof VNUx !== 'undefined' && VNUx.openCodexGallery){
    VNUx.openCodexGallery('cg');
    return;
  }
  show('codex',1);
  const got = ACH.filter(a=>S.ach[a.id]);
  $('codex-list').innerHTML = `
    <p style="margin-bottom:8px">结局 ${codex.endings?.length||0} · 成就 ${got.length}/${ACH.length}</p>
    <p style="opacity:.7;font-size:12px">未解锁内容不会显示。</p>
    <div style="margin-top:12px">${got.map(a=>`<div class="p-ach">✦ ${a.name}</div>`).join('') || '（空）'}</div>`;
};
$('btn-codex-close').onclick=()=>show('codex',0);

// 自由探索底部按钮直接推进季度，不再弹出二次选择或换季提示对话框
doNextTime = function(){
  /* direct season advance -> showSeasonFlavor */
  const steps = S.ageY < 1 ? 4 : 1;
  for(let i = 0; i < steps; i++) advanceSeason(1);
  enterFreeRoam({deferGreeting:true});
  // 无论本季度是否有剧情，风物提示都要显示；有剧情时延后到全部剧情结束。
  S.seasonFlavorPending=true;
  save();
  if(checkStoryGates()) return;
  S.seasonFlavorPending=false;
  showSeasonFlavor(()=>{
    updateHUD();
    renderHotspots();
  });
  updateHUD();
  renderHotspots();
};


// unlock study with age via rest/advance
const _advDay = advanceDay;
advanceDay = function(n){
  _advDay(n);
  if(S.ageY>=1){ LOCS.study.unlock=true; LOCS.training.unlock=true; }
  if(S.ageY>=2){ LOCS.kitchen.unlock=true; LOCS.balcony.unlock=true; }
  if(S.ageY>=4){ LOCS.chapel.unlock=true; LOCS.town.unlock=true; }
  if(S.ageY>=6){ LOCS.cellar.unlock=true; }
  if(S.ageY>=8 && S.tier<2 && flag('mana_awakened')){ /* mid tier via lv */ }
  if(S.ageY>=3 && !flag('unlock_study_talk')){ flag('unlock_study_talk',1); }
};

// keyboard
document.addEventListener('keydown', e=>{
  const tgt = e.target;
  const tagName = tgt && tgt.tagName ? tgt.tagName.toUpperCase() : '';
  const isEditable = !!(tgt && (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tgt.isContentEditable));
  if(e.key==='Escape'){
    if($('ai-drawer') && !$('ai-drawer').classList.contains('hidden') && typeof AIChatPanel !== 'undefined' && AIChatPanel.closeDrawer){
      AIChatPanel.closeDrawer({ wipePending: true });
      return;
    }
    if($('letter-demo') && !$('letter-demo').classList.contains('hidden')){
      closeLetterDemo();
      return;
    }
    show('panel',0); show('map-overlay',0); show('help-screen',0); show('codex',0); show('stats-overlay',0); show('backlog-overlay',0); show('sys-popup',0); uiShow();
    return;
  }
  if(isEditable) return;
  if($('ai-drawer') && !$('ai-drawer').classList.contains('hidden')) return;
  if(e.key===' ' || e.key==='Enter'){
    // CG 演出：空格/回车也能推进下一句
    if(cgActive && !$('cg-screen').classList.contains('hidden')){
      if(typeof $('cg-screen').onclick === 'function'){ $('cg-screen').onclick(); }
      return;
    }
    // 章节报幕 card：空格/回车翻页
    const cd=$('card');
    if(cd && !cd.classList.contains('hidden')){
      if(typeof cd.onclick === 'function'){ cd.onclick(); }
      return;
    }
    // 系统弹窗：空格/回车关闭
    const sp=$('sys-popup');
    if(sp && !sp.classList.contains('hidden')){ show(sp,0); return; }
    // 各面板：空格关闭
    if(!$('panel').classList.contains('hidden')){ show('panel',0); return; }
    if(!$('stats-overlay').classList.contains('hidden')){ show('stats-overlay',0); return; }
    if(!$('map-overlay').classList.contains('hidden')){ show('map-overlay',0); return; }
    if($('backlog-overlay') && !$('backlog-overlay').classList.contains('hidden')){ show('backlog-overlay',0); return; }
    if(!$('game-screen').classList.contains('hidden')) $('text-box').click();
  }
  if((e.key==='p'||e.key==='P') && !$('game-screen').classList.contains('hidden')) openPanel('status');
  if((e.key==='l'||e.key==='L') && !$('game-screen').classList.contains('hidden')){
    if(typeof VNUx!=='undefined'&&VNUx.toggleBacklogModal) return; // 由 js/vn-ux.js 统一接管 L 键，避免双弹窗重叠
    const bo = $('backlog-overlay');
    if(bo && bo.classList.contains('hidden')) openBacklog();
    else if(bo) show('backlog-overlay', 0);
  }
  if((e.key==='m'||e.key==='M') && S.freeRoam) openMap();
});


// ===== merge full story from story.js, story-vol3.js & story-vol4.js =====
(function mergeStory(){
  const pack = (typeof STORY_SCENES !== 'undefined') ? STORY_SCENES : (typeof window!=='undefined' ? window.STORY_SCENES : null);
  const pack3 = (typeof STORY_VOL3_SCENES !== 'undefined') ? STORY_VOL3_SCENES : (typeof window!=='undefined' ? window.STORY_VOL3_SCENES : null);
  const pack4 = (typeof STORY_VOL4_SCENES !== 'undefined') ? STORY_VOL4_SCENES : (typeof window!=='undefined' ? window.STORY_VOL4_SCENES : null);
  if(!pack && !pack3 && !pack4){ console.warn('[story] STORY_SCENES missing'); return; }
  if(pack) Object.keys(pack).forEach(k=>{ SCENES[k] = pack[k]; });
  if(pack3) Object.keys(pack3).forEach(k=>{ SCENES[k] = pack3[k]; });
  if(pack4) Object.keys(pack4).forEach(k=>{ SCENES[k] = pack4[k]; });
  const chaps = (typeof STORY_CHAPTERS !== 'undefined') ? STORY_CHAPTERS : (typeof window!=='undefined' ? window.STORY_CHAPTERS : null);
  const chaps3 = (typeof STORY_VOL3_CHAPTERS !== 'undefined') ? STORY_VOL3_CHAPTERS : (typeof window!=='undefined' ? window.STORY_VOL3_CHAPTERS : null);
  const chaps4 = (typeof STORY_VOL4_CHAPTERS !== 'undefined') ? STORY_VOL4_CHAPTERS : (typeof window!=='undefined' ? window.STORY_VOL4_CHAPTERS : null);
  const spliceBeforeEnding = (list)=>{
    if(!Array.isArray(chaps) || !Array.isArray(list)) return;
    const toAdd = list.filter(c => c && !chaps.some(x => x && x.id === c.id));
    const endingIdx = chaps.findIndex(c => c && c.id === 's_ending_menu');
    if(endingIdx >= 0) chaps.splice(endingIdx, 0, ...toAdd);
    else chaps.push(...toAdd);
  };
  spliceBeforeEnding(chaps3);
  spliceBeforeEnding(chaps4);
  console.log('[story] merged scenes', Object.keys(SCENES).length);
})();

let _snowRaf = 0;
function startTitleSnowLoop(){
  if(typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) return;
  const canvas = $('title-snow-canvas');
  const titleScr = $('title-screen');
  if(!canvas || !titleScr || titleScr.classList.contains('hidden')) return;
  let ctx = null;
  try { ctx = canvas.getContext('2d'); } catch(e){}
  if(!ctx) return;
  if(_snowRaf) return;
  const reduceMotion = !!(typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(!reduceMotion && typeof requestAnimationFrame !== 'function') return;
  const syncSize = ()=>{
    const cw = titleScr.clientWidth || window.innerWidth || 1440;
    const ch = titleScr.clientHeight || window.innerHeight || 900;
    if(canvas.width !== cw || canvas.height !== ch){
      canvas.width = cw;
      canvas.height = ch;
    }
  };
  syncSize();
  const motes = Array.from({length: 52}, (_, idx) => {
    const mod = idx % 6;
    const tier = mod === 0 ? 'cobalt' : (mod === 1 || mod === 3 ? 'cyan' : 'white');
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: tier === 'white' ? (1.8 + Math.random() * 2.9) : (2.1 + Math.random() * 2.8),
      vy: 0.28 + Math.random() * 0.52,
      vx: -0.18 + Math.random() * 0.36,
      alpha: 0.55 + Math.random() * 0.45,
      rot: Math.random() * Math.PI * 2,
      vrot: (Math.random() < 0.5 ? -1 : 1) * (0.004 + Math.random() * 0.011),
      phase: Math.random() * Math.PI * 2,
      vphase: 0.016 + Math.random() * 0.022,
      tier,
    };
  });
  const drawFrame = (animate)=>{
    syncSize();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for(const f of motes){
      if(animate){
        f.phase += f.vphase;
        f.rot += f.vrot;
        f.x += f.vx + Math.sin(f.y * 0.012 + f.phase * 0.35) * 0.16;
        f.y += f.vy;
        const pad = f.r + 8;
        if(f.y > canvas.height + pad){ f.y = -pad; f.x = Math.random() * canvas.width; }
        if(f.x < -pad) f.x = canvas.width + pad;
        else if(f.x > canvas.width + pad) f.x = -pad;
      }
      const shimmer = 0.72 + 0.28 * Math.sin(f.phase);
      const scale = f.alpha * shimmer;
      const r = f.r;
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rot);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.68, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.68, 0);
      ctx.closePath();
      if(f.tier === 'cyan'){
        ctx.fillStyle = `rgba(56, 189, 248, ${(0.58 * scale).toFixed(3)})`;
      } else if(f.tier === 'cobalt'){
        ctx.fillStyle = `rgba(18, 80, 230, ${(0.34 * scale).toFixed(3)})`;
      } else {
        ctx.fillStyle = `rgba(255, 255, 255, ${(0.88 * scale).toFixed(3)})`;
      }
      ctx.fill();
      if(f.tier === 'white' && r >= 3.0){
        ctx.strokeStyle = `rgba(56, 189, 248, ${(0.34 * scale).toFixed(3)})`;
        ctx.lineWidth = 0.75;
        ctx.stroke();
      }
      ctx.restore();
    }
  };
  if(reduceMotion){
    drawFrame(false);
    return;
  }
  const step = ()=>{
    if(!titleScr || titleScr.classList.contains('hidden')){
      _snowRaf = 0;
      return;
    }
    drawFrame(true);
    _snowRaf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(step) : 0;
  };
  _snowRaf = requestAnimationFrame(step);
}

// boot
show('btn-continue', hasSave());
updateHUD();
syncMuteBtn();
syncUiToggleBtn(false);
startTitleSnowLoop();
bgmBindGlobalUnlock(); // 全局用户手势解锁音频
applySettings(); // 应用已保存的设置（bgm音量/背景亮度）
console.log('[转生千金] ready · scenes', Object.keys(SCENES).length);
if(typeof window !== 'undefined'){
  window.SCENES = SCENES;
  window.S = S;
  window.show = show;
  window.whoIsHere = whoIsHere;
  window.checkStoryGates = checkStoryGates;
  window.phaseAreaAllowed = phaseAreaAllowed;
  window.getStoryChain = ()=>storyChain;
  window.love = typeof love !== 'undefined' ? love : ()=>{};
  window.flag = typeof flag !== 'undefined' ? flag : ()=>{};
  window.know = typeof know !== 'undefined' ? know : ()=>{};
  window.sysPopup = typeof sysPopup !== 'undefined' ? sysPopup : ()=>{};
  window.toast = typeof toast !== 'undefined' ? toast : ()=>{};
  window.sfx = typeof sfx !== 'undefined' ? sfx : ()=>{};
  window.sfxSetVolume = sfxSetVolume;
  window.sfxGetVolume = ()=>sfxVolume;
  window.setTypeSpeed = setTypeSpeed;
  window.getTypeSpeed = getTypeSpeed;
  window.advanceDialog = advanceDialog;
  window.bgmKeyForBg = typeof bgmTypeForBg !== 'undefined' ? bgmTypeForBg : ()=>{};
  window.bgmTypeForBg = typeof bgmTypeForBg !== 'undefined' ? bgmTypeForBg : ()=>{};
  window.bgmPlay = typeof bgmPlay !== 'undefined' ? bgmPlay : ()=>{};
  window.bgmStop = typeof bgmStop !== 'undefined' ? bgmStop : ()=>{};
  window.bgmSetVolume = typeof bgmSetVolume !== 'undefined' ? bgmSetVolume : ()=>{};
  window.bgmGetVolume = ()=>bgmVolume;
  window.bgmUnlock = typeof bgmUnlock !== 'undefined' ? bgmUnlock : ()=>{};
  window.bgmPlayType = typeof bgmPlayType !== 'undefined' ? bgmPlayType : ()=>{};
  window.BGM_FILES = typeof BGM_FILES !== 'undefined' ? BGM_FILES : {};
  window.BGM_GROUPS = typeof BGM_GROUPS !== 'undefined' ? BGM_GROUPS : {};
  window.ACH = ACH;
  window.codex = codex;
  window.saveCodex = saveCodex;
  window.PORTRAIT_DIFF_PROTOCOL = PORTRAIT_DIFF_PROTOCOL;
  window.FAILED_PORTRAIT_URLS = FAILED_PORTRAIT_URLS;
  window.resolvePortrait = resolvePortrait;
  window.resolvePortraitFallback = resolvePortraitFallback;
  window.LOCS = LOCS;
  window.__LOCS = LOCS;
  window.CHARS = CHARS;
  window.save = save;
  window.load = load;
  window.runScene = runScene;
  window.enterFreeRoam = enterFreeRoam;
  window.openPanel = openPanel;
  window.openStatsPanel = openStatsPanel;
  window.triggerBraveGift = triggerBraveGift;
  window.updateHUD = updateHUD;
  window.updateLocBar = updateLocBar;
  window.baseState = baseState;
  window.migrateStorySave = migrateStorySave;
  window.runSceneQueue = runSceneQueue;
  window.resumePendingStories = resumePendingStories;
  window.syncStatsToAge = syncStatsToAge;
  window.setBG = setBG;
  window.renderHotspots = renderHotspots;
  window.STORY_CHAPTERS = typeof STORY_CHAPTERS !== 'undefined' ? STORY_CHAPTERS : window.STORY_CHAPTERS;
  window.__STORY_CHAPTERS = window.STORY_CHAPTERS;
  window.STORY_GATE_BY_SCENE = STORY_GATE_BY_SCENE;
  window.__vnApplyLoadedState = function(restored, curSc, curChain){
    S = restored;
    window.S = S;
    currentScene = curSc || null;
    storyChain = curChain || null;
    Object.values(LOCS).forEach(L=>{
      if(S.phase !== 'prologue' && L.area === '公爵府') L.unlock = true;
      if(S.phase === 'academy' || S.phase === 'journey' || S.phase === 'finale'){
        if(L.area === '魔法大学') L.unlock = true;
      }
      if(S.phase === 'journey' || S.phase === 'finale'){
        if(['road','jikan','chenglan_guild','northforest','town','market'].includes(L.id)) L.unlock = true;
        if(flag('ch_distant_wind_2') && L.id === 'ice_canyon') L.unlock = true;
      }
    });
  };
}
