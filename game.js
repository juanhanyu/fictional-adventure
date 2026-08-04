/* =========================================================
   转生千金～到了异世界就要悠闲地生活
   时间轴 + 体力 + 自由探索 + 勇者之赐 + 立绘差分
   ========================================================= */
'use strict';

const SAVE_KEY = 'ojousama_save_v1';
const CODEX_KEY = 'ojousama_codex_v1';
const MUTE_KEY = 'ojousama_muted';
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
function seasonName(s){ return SEASON_ICON[s]+SEASONS[s]; }


// ========== AUDIO ==========
let ACTX = null, muted = localStorage.getItem(MUTE_KEY) === '1';
function ensureAudio(){ if(!ACTX) try{ ACTX = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){} }
function sfx(type){
  if(muted) return; ensureAudio(); if(!ACTX) return;
  const o = ACTX.createOscillator(), g = ACTX.createGain();
  o.connect(g); g.connect(ACTX.destination);
  const t = ACTX.currentTime;
  const map = {
    click:[800,.05,'square'], ok:[520,.12,'sine'], level:[660,.2,'triangle'],
    bad:[180,.2,'sawtooth'], magic:[880,.15,'sine'], open:[400,.1,'triangle'],
    page:[600,.04,'square'], heart:[700,.18,'sine'], egg:[1000,.25,'triangle']
  };
  const [f,d,w] = map[type] || map.click;
  o.type = w; o.frequency.value = f; g.gain.setValueAtTime(.06,t); g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.start(t); o.stop(t+d);
}

// ========== PORTRAITS ==========
const PORTRAIT_FILES = {
  sylvia_normal:'assets/portraits/sylvia_normal.png',
  sylvia_smile:'assets/portraits/sylvia_smile.png',
  sylvia_serious:'assets/portraits/sylvia_serious.png',
  sylvia_child:'assets/portraits/sylvia_child.png',
  beatrice_normal:'assets/portraits/beatrice_normal.png',
  beatrice_happy:'assets/portraits/beatrice_happy.png',
  beatrice_sad:'assets/portraits/beatrice_sad.png',
  beatrice_child:'assets/portraits/beatrice_child.png',
  alice_normal:'assets/portraits/alice_normal.png',
  alice_smile:'assets/portraits/alice_smile.png',
  alice_shy:'assets/portraits/alice_shy.png',
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
  huke_normal:'assets/portraits/huke_normal.png',
};
function portraitAgeTier(){
  // 0 infant/hidden, 1 child <10, 2 teen+
  if(!flag('named')) return 0;
  if(S.ageY < 10) return 1;
  return 2;
}
function resolvePortrait(charId, emotion){
  const emo = emotion || 'normal';
  const tier = portraitAgeTierFor(charId);
  if(charId==='sylvia'){
    if(!flag('named')) return null; // hidden before naming
    if(tier===1) return PORTRAIT_FILES.sylvia_child || PORTRAIT_FILES.sylvia_normal;
    return PORTRAIT_FILES['sylvia_'+emo] || PORTRAIT_FILES.sylvia_normal;
  }
  if(charId==='beatrice'){
    if(S.ageY < 10) return PORTRAIT_FILES.beatrice_child || PORTRAIT_FILES.beatrice_normal;
    return PORTRAIT_FILES['beatrice_'+emo] || PORTRAIT_FILES.beatrice_normal;
  }
  if(charId==='alice'){
    // child-like until 12
    if(S.ageY < 12) return PORTRAIT_FILES.alice_normal; // only one set for now
    return PORTRAIT_FILES['alice_'+emo] || PORTRAIT_FILES.alice_normal;
  }
  return PORTRAIT_FILES[charId+'_'+emo] || PORTRAIT_FILES[charId+'_normal'] || null;
}
function portraitAgeTierFor(charId){
  if(charId==='sylvia') return portraitAgeTier();
  if(charId==='beatrice') return S.ageY < 10 ? 1 : 2;
  if(charId==='alice') return S.ageY < 12 ? 1 : 2;
  return 2;
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
  ownroom:{id:'ownroom', name:'自己的房间', icon:'🛏️', area:'公爵府', desc:'属于自己的房间', bg:'bg-img-nursery bg-room', unlock:false, st:0, tags:['rest']},
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
  northforest:{id:'northforest', name:'北林', icon:'🌲', area:'澄岚镇', desc:'魔物出没的林地', bg:'bg-img-forest bg-forest', unlock:false, st:3, tags:['train']},
};


// ========== ROOM EXITS (clickable hotspots) ==========
// pos: percent x,y on stage
const EXITS = {
  nursery:[
    // 婴儿默认只能待在育婴室；特殊出口由 renderHotspots 注入「闹着要出去」
    {to:'hallway', label:'门 · 长廊', icon:'🚪', x:88, y:48, st:1, needAge:1},
    {to:'parlor', label:'去起居室', icon:'🛋️', x:70, y:78, st:1, needAge:1},
  ],
  ownroom:[
    {to:'hallway', label:'长廊', icon:'🚪', x:88, y:48, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:70, y:78, st:0},
  ],
  hallway:[
    {to:'nursery', label:'育婴室', icon:'🛏️', x:18, y:50, st:0},
    {to:'ownroom', label:'自己的房间', icon:'🛏️', x:18, y:50, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:50, y:70, st:0},
    {to:'dining', label:'餐厅', icon:'🍽️', x:82, y:48, st:1},
    {to:'garden', label:'花园', icon:'🌹', x:50, y:22, st:1},
    {to:'study', label:'图书室', icon:'📚', x:30, y:30, st:1, needAge:1},
    {to:'kitchen', label:'厨房', icon:'🍳', x:75, y:75, st:1, needAge:2},
    {to:'balcony', label:'露台', icon:'🌙', x:88, y:28, st:1, needAge:2},
    {to:'training', label:'练武场', icon:'⚔️', x:12, y:75, st:1, needAge:1},
    {to:'chapel', label:'小礼拜堂', icon:'⛪', x:40, y:80, st:1, needAge:4},
    {to:'cellar', label:'酒窖', icon:'🍷', x:20, y:85, st:2, needAge:6},
  ],
  parlor:[
    {to:'hallway', label:'长廊', icon:'🚪', x:15, y:50, st:0},
    {to:'dining', label:'餐厅', icon:'🍽️', x:85, y:55, st:0},
    {to:'garden', label:'花园', icon:'🌹', x:50, y:20, st:1},
    {to:'nursery', label:'育婴室', icon:'🛏️', x:25, y:75, st:0},
    {to:'ownroom', label:'自己的房间', icon:'🛏️', x:25, y:75, st:0, needAge:8},
  ],
  garden:[
    {to:'hallway', label:'回府 · 长廊', icon:'🏛️', x:50, y:85, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:20, y:70, st:0},
    {to:'dining', label:'餐厅侧门', icon:'🍽️', x:75, y:80, st:0},
    {to:'training', label:'练武场', icon:'⚔️', x:80, y:60, st:1, needAge:1},
    {to:'town', label:'出府 · 小镇', icon:'🏘️', x:50, y:15, st:3, needAge:4},
  ],
  study:[
    {to:'hallway', label:'长廊', icon:'🚪', x:15, y:50, st:0},
    {to:'balcony', label:'露台', icon:'🌙', x:85, y:30, st:0, needAge:2},
  ],
  dining:[
    {to:'hallway', label:'长廊', icon:'🚪', x:15, y:50, st:0},
    {to:'parlor', label:'起居室', icon:'🛋️', x:50, y:80, st:0},
    {to:'kitchen', label:'厨房', icon:'🍳', x:85, y:55, st:0, needAge:2},
  ],
  kitchen:[
    {to:'dining', label:'餐厅', icon:'🍽️', x:20, y:50, st:0},
    {to:'hallway', label:'长廊', icon:'🚪', x:50, y:80, st:0},
    {to:'cellar', label:'酒窖', icon:'🍷', x:80, y:70, st:1, needAge:6},
  ],
  training:[
    {to:'garden', label:'花园', icon:'🌹', x:50, y:20, st:0},
    {to:'hallway', label:'长廊', icon:'🚪', x:20, y:70, st:0},
  ],
  balcony:[
    {to:'hallway', label:'长廊', icon:'🚪', x:20, y:60, st:0},
    {to:'study', label:'图书室', icon:'📚', x:70, y:50, st:0, needAge:1},
  ],
  chapel:[
    {to:'hallway', label:'长廊', icon:'🚪', x:50, y:80, st:0},
  ],
  cellar:[
    {to:'kitchen', label:'厨房', icon:'🍳', x:50, y:25, st:0},
    {to:'hallway', label:'长廊', icon:'🚪', x:20, y:50, st:1},
    {to:'secret', label:'松动的砖墙…', icon:'🗝️', x:80, y:70, st:1, needFlag:'can_secret'},
  ],
  secret:[
    {to:'cellar', label:'退回酒窖', icon:'🍷', x:50, y:30, st:0},
  ],
  town:[
    {to:'garden', label:'回公爵府', icon:'🌹', x:20, y:70, st:2},
    // 材料市场与公爵小镇不互通，需从王都单独进入
    {to:'beach', label:'海滨方向', icon:'🏖️', x:50, y:20, st:3, needAge:8},
  ],
  market:[
    // 材料市场不与公爵小镇互通，从学院/王都进入后只能回学院
    {to:'dorm', label:'回学院宿舍', icon:'🏠', x:20, y:60, st:1},
  ],
  beach:[
    {to:'town', label:'回小镇', icon:'🏘️', x:50, y:80, st:2},
  ],
  dorm:[
    {to:'cafeteria', label:'食堂', icon:'🍮', x:70, y:40, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:30, y:35, st:1},
    {to:'water_class', label:'水系教室', icon:'💧', x:80, y:65, st:1},
    {to:'training_field', label:'训练场', icon:'🗡️', x:20, y:70, st:1},
    {to:'auditorium', label:'礼堂', icon:'🏛️', x:50, y:25, st:1},
    {to:'market', label:'材料市场', icon:'🛒', x:35, y:80, st:2, needPhase:'academy'},
  ],
  water_class:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:20, y:50, st:1},
    {to:'ice_class', label:'冰系教室', icon:'❄️', x:80, y:40, st:1},
    {to:'cafeteria', label:'食堂', icon:'🍮', x:50, y:80, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:35, y:25, st:1},
    {to:'training_field', label:'训练场', icon:'🗡️', x:70, y:75, st:1},
  ],
  ice_class:[
    {to:'water_class', label:'水系教室', icon:'💧', x:20, y:50, st:0},
    {to:'flowerhouse', label:'花坊', icon:'🌺', x:80, y:45, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:50, y:80, st:1},
  ],
  library:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:20, y:60, st:1},
    {to:'clocktower', label:'钟塔', icon:'🗼', x:80, y:30, st:2},
    {to:'cafeteria', label:'食堂', icon:'🍮', x:50, y:80, st:1},
  ],
  cafeteria:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:20, y:50, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:50, y:25, st:1},
    {to:'training_field', label:'训练场', icon:'🗡️', x:80, y:60, st:1},
  ],
  clocktower:[
    {to:'library', label:'下楼 · 图书馆', icon:'📖', x:50, y:80, st:1},
  ],
  flowerhouse:[
    {to:'ice_class', label:'冰系教室', icon:'❄️', x:20, y:50, st:0},
    {to:'memorial', label:'纪念林', icon:'🌳', x:80, y:40, st:1},
  ],
  training_field:[
    {to:'cafeteria', label:'食堂', icon:'🍮', x:30, y:80, st:1},
    {to:'dorm', label:'宿舍', icon:'🏠', x:70, y:80, st:1},
    {to:'memorial', label:'纪念林', icon:'🌳', x:50, y:20, st:1},
  ],
  memorial:[
    {to:'training_field', label:'训练场', icon:'🗡️', x:50, y:80, st:1},
    {to:'flowerhouse', label:'花坊', icon:'🌺', x:20, y:40, st:1},
    {to:'library', label:'图书馆', icon:'📖', x:80, y:55, st:1},
  ],
  auditorium:[
    {to:'dorm', label:'宿舍', icon:'🏠', x:20, y:60, st:1},
    {to:'cafeteria', label:'食堂', icon:'🍮', x:80, y:60, st:1},
    {to:'water_class', label:'水系教室', icon:'💧', x:50, y:80, st:1},
  ],
  road:[
    {to:'jikan', label:'澄岚 · 霁馆', icon:'🏯', x:70, y:45, st:2},
    {to:'northforest', label:'北林', icon:'🌲', x:30, y:30, st:2},
  ],
  jikan:[
    {to:'northforest', label:'北林', icon:'🌲', x:70, y:30, st:2},
    {to:'road', label:'官道', icon:'🛤️', x:30, y:75, st:1},
  ],
  northforest:[
    {to:'jikan', label:'回霁馆', icon:'🏯', x:50, y:80, st:2},
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
    desc:'普通饮食也可微量回复魔力。'},
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
    desc:'①攻击造成伤害后回复等量魔力（不超过上限）。②魔法伤害额外增加：原伤害×(该魔法消耗÷总魔力值)。'},
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
  noelle_14:{id:'mana_calc', name:'魔力精算', desc:'施法时自动优化魔力路径，减少约10%-15%消耗。'},
  aino_cur:{id:'root_ice', name:'生根之冰', desc:'冰墙/冰盾可从地面生根，结构大幅强化。'},
  claude_cur:{id:'noble_bearing', name:'公爵气度', desc:'交涉与威慑类检定小幅提升。'},
  sophia_cur:{id:'lullaby', name:'摇篮曲', desc:'休息时额外回复魔力与好感。'},
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
    lastSafe:'nursery',
    // 养成四维（火山的女儿式）0-100
    stats:{ body:5, mind:15, mana:10, charm:8 },
    courses:{}, // id -> {lv, exp}
    skillsLearned:[],
    // season 0春1夏2秋3冬
    restThisSeason: 0,
    sickUntil: 0,
    seasonChars: {}, // season -> {char: loc}
  };
}
let S = baseState();
let B = null; // battle
let sceneQueue = [];
let typing = false, typeTimer = null, fullText = '', textIdx = 0;
let currentScene = null;
let pendingPicks = null;
let codex = JSON.parse(localStorage.getItem(CODEX_KEY) || '{"endings":[],"chars":[],"eggs":0}');

// ========== UTILS ==========
const $ = id => document.getElementById(id);
const show = (el,on=true) => { if(typeof el==='string') el=$(el); if(el) el.classList.toggle('hidden', !on); };
function toast(msg, ms=2200){ const t=$('toast'); t.textContent=msg; show(t,1); clearTimeout(t._t); t._t=setTimeout(()=>show(t,0),ms); }
function sysPopup(title, body){
  const p=$('sys-popup'); p.innerHTML=`<h3>${title}</h3><div>${body}</div><button class="sp-close" onclick="this.parentNode.classList.add('hidden')">确认</button>`;
  show(p,1); sfx('open');
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
  if(n<=0) return; S.exp += n;
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
function addItem(it){ S.inv.push(it); toast(`📦 获得：${it.name}`); sfx('ok'); }
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
    if(hasSkill('ice_palace')) flag('palace_today', 0);
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
    if(hasSkill('ice_palace')) flag('palace_today', 0);
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
  syncStatsToAge();
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
function save(){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
function load(){ try{ const r=localStorage.getItem(SAVE_KEY); if(r){ S=Object.assign(baseState(), JSON.parse(r)); return true; } }catch(e){} return false; }
function saveCodex(){ localStorage.setItem(CODEX_KEY, JSON.stringify(codex)); }
function hasSave(){ return !!localStorage.getItem(SAVE_KEY); }

// ========== HUD / UI ==========
function updateHUD(){
  const named = flag('named');
  $('hud-name').textContent = !named ? '？？？' : (S.alias || '希尔维亚');
  $('hud-age').textContent = ageStr();
  $('hud-tier').textContent = tierName();
  $('hud-gold').textContent = '🪙'+S.gold;
  $('hud-date').textContent = dateStr();
  $('hud-tod').textContent = S.phase;
  const hpP=S.mhp?S.hp/S.mhp*100:0, mpP=S.mmp?S.mp/S.mmp*100:0, stP=S.mst?S.st/S.mst*100:0;
  $('hud-hp').style.width=hpP+'%'; $('hud-hp-num').textContent=`${S.hp}/${S.mhp}`;
  $('hud-mp').style.width=mpP+'%'; $('hud-mp-num').textContent=`${S.mp}/${S.mmp}`;
  $('hud-st').style.width=stP+'%'; $('hud-st-num').textContent=`${S.st}/${S.mst}`;
  const face = $('hud-face-img');
  if(!named){
    face.style.opacity = '0.15';
    face.style.filter = 'blur(6px) grayscale(1)';
    face.src = '';
    face.alt = '';
  } else {
    face.style.opacity = '1';
    face.style.filter = 'none';
    const src = resolvePortrait('sylvia', S.alias==='眷寒渔' ? 'serious' : 'normal');
    if(src) face.src = src;
  }
  show('btn-continue', hasSave());
  $('codex-count').textContent = `${Object.keys(S.ach||{}).length || codex.eggs || 0}`;
}

function setBG(cls){
  const bg=$('bg'); bg.className='';
  (cls||'bg-title').split(/\s+/).forEach(c=>bg.classList.add(c));
}

// ========== PORTRAITS ==========
function clearPortraits(){
  ['p-left','p-center','p-right'].forEach(id=>{
    const el=$(id); el.classList.add('hidden'); el.classList.remove('active','dim');
  });
  $('css-portraits').innerHTML='';
}
function showPortrait(charId, emotion='normal', slot='center', active=true){
  const file = (typeof resolvePortrait==='function') ? resolvePortrait(charId, emotion) : (PORTRAIT_FILES[charId+'_'+(emotion||'normal')]||PORTRAIT_FILES[charId+'_normal']);
  const el = $(slot==='left'?'p-left':slot==='right'?'p-right':'p-center');
  if(!el) return;
  const img = el.querySelector('img');
  const nm = el.querySelector('.p-name');
  // 未命名前不显示主角立绘
  if(charId==='sylvia' && !flag('named')){
    el.classList.add('hidden');
    return;
  }
  if(file){
    img.src = file; img.onerror = ()=>{ el.classList.add('hidden'); addCssPortrait(charId, active); };
    el.classList.remove('hidden');
    nm.textContent = (charId==='sylvia' && !flag('named')) ? '？？？' : (CHARS[charId]?.short || charId);
    el.classList.toggle('active', active); el.classList.toggle('dim', !active);
  } else {
    el.classList.add('hidden'); addCssPortrait(charId, active);
  }
}
function addCssPortrait(charId, active=true){
  const c = CSS_CHARS[charId] || CSS_CHARS.sylvia;
  const d = document.createElement('div');
  d.className = `css-p ${CHARS[charId]?.css||charId}${active?'':' dim'}`;
  d.innerHTML = `<div class="face"></div><div class="cn">${c[0]}</div>`;
  $('css-portraits').appendChild(d);
}
function setSpeaker(name){
  const sp=$('speaker');
  if(name){ sp.textContent=name; sp.classList.remove('hidden'); }
  else sp.classList.add('hidden');
}

// ========== TEXT ENGINE ==========
let lineCB = null;
let typeDoneCB = null;
let lineGen = 0;
let awaitingChoice = false;

function typeText(str, cb){
  const box = $('text');
  fullText = String(str ?? '');
  textIdx = 0;
  typing = true;
  typeDoneCB = cb || null;
  lineCB = null; // IMPORTANT: never auto-advance; only arm after click finishes type
  box.innerHTML = '';
  clearInterval(typeTimer);
  // show first chars immediately so something is visible
  if(!fullText){
    typing = false;
    // still require a click to continue empty? treat as done after click
    lineCB = ()=>{ const c=typeDoneCB; typeDoneCB=null; if(c) c(); };
    return;
  }
  // reveal gradually; when finished STAY until user clicks
  typeTimer = setInterval(()=>{
    if(textIdx >= fullText.length){
      clearInterval(typeTimer);
      typing = false;
      box.innerHTML = escapeText(fullText);
      // Do NOT call typeDoneCB here — wait for player click
      // Arm lineCB to mean "continue to next line"
      lineCB = ()=>{
        const c = typeDoneCB;
        typeDoneCB = null;
        lineCB = null;
        if(c) c();
      };
      return;
    }
    textIdx = Math.min(fullText.length, textIdx + 2);
    box.innerHTML = escapeText(fullText.slice(0, textIdx));
    if(box.parentElement) box.parentElement.scrollTop = box.parentElement.scrollHeight;
  }, 16);
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
  if(L.portraits){
    clearPortraits();
    L.portraits.forEach(p=> showPortrait(p.id, p.emo||'normal', p.slot||'center', p.active!==false));
  } else if(L.ch){
    clearPortraits();
    showPortrait(L.ch, L.emo||'normal', L.slot||'center', true);
    if(!L.speaker && CHARS[L.ch]) L.speaker = CHARS[L.ch].short;
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
      const L = list[i++];

      // plain string
      if(typeof L === 'string'){
        setSpeaker(null);
        typeText(L, ()=>{ if(gen===lineGen) next(); });
        return;
      }
      if(!L || typeof L !== 'object') continue;

      // run do first
      if(typeof L.do === 'function'){
        try { L.do(); } catch(e){ console.error('line.do', e); }
      }

      applyLineEffects(L);

      // chapter card — pause then continue this line's text or next
      if(L.card){
        showCard(L.card.vol, L.card.t, L.card.s, ()=>{
          if(gen !== lineGen) return;
          if(L.text){
            setSpeaker(L.speaker||null);
            typeText(L.text, ()=>{ if(gen===lineGen) next(); });
          } else next();
        });
        return;
      }

      if(L.choices){
        awaitingChoice = true;
        setSpeaker(L.speaker||null);
        clearInterval(typeTimer);
        typing = false;
        typeDoneCB = null;
        lineCB = null;
        fullText = String(L.text || '请选择：');
        $('text').innerHTML = escapeText(fullText);
        showChoices(L.choices, ()=>{});
        return;
      }

      if(L.goto){ runScene(L.goto); return; }

      if(L.freeRoam){
        typeText(L.text || '（可以自由行动了。点击画面出口移动，或用下方按钮。）', ()=>{
          if(gen !== lineGen) return;
          enterFreeRoam();
        });
        return;
      }

      if(L.pickTier != null){
        flag('resume_after_pick', 1);
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
        setSpeaker(L.speaker||null);
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
function bindAdvance(){
  const tb = $('text-box');
  if(!tb) return;
  tb.onclick = (e)=>{
    // don't steal clicks from buttons inside
    if(e.target.closest('button')) return;
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

// ========== FREE ROAM ==========


function phaseAreaAllowed(area){
  const ph = S.phase;
  if(ph==='prologue' || ph==='childhood' || ph==='youth'){
    return area==='公爵府' || area==='领地' || area==='王都';
  }
  if(ph==='academy'){
    // 入学后不可自由回公爵府
    return area==='魔法大学' || area==='王都' || area==='领地';
  }
  if(ph==='journey' || ph==='finale'){
    // 旅途后不可自由回学院/公爵府
    return area==='旅途' || area==='澄岚镇' || area==='王都';
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
  const peeps = whoIsHere();
  // stage portraits for NPCs present
  clearPortraits();
  const pRoot = $('portraits');
  if(pRoot) pRoot.classList.add('roam-npc');
  const slots = ['left','center','right'];
  peeps.slice(0,3).forEach((id,i)=>{
    const slot = slots[i] || 'center';
    showPortrait(id, 'normal', slot, true);
    const el = $(slot==='left'?'p-left':slot==='right'?'p-right':'p-center');
    if(el){
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      el.onclick = (e)=>{
        e.stopPropagation();
        if(!S.freeRoam) return;
        sfx('click');
        talkTo(id);
      };
    }
  });
  if(!usable.length && !peeps.length){ show(box,0); return; }
  show(box,1);
  usable.forEach((ex,i)=>{
    const b = document.createElement('button');
    b.className = 'hotspot' + (ex.egg?' egg':'') + (ex.babyFuss?' locked-baby':'');
    b.style.left = (ex.x|| (20+i*20)) + '%';
    b.style.top = (ex.y|| 50) + '%';
    const st = ex.st||0;
    const costTxt = st>0 ? `<span class="hs-cost">⚡${st}</span>` : '';
    b.innerHTML = `<span class="hs-icon">${ex.icon||'➡️'}</span>${ex.label||LOCS[ex.to]?.name||ex.to}${costTxt}`;
    b.onclick = (e)=>{
      e.stopPropagation();
      if(!S.freeRoam) return;
      sfx('click');
      if(ex.babyFuss){ doBabyFuss(ex.fussTo || 'parlor', st); return; }
      if(st>0 && !spendST(st)) return;
      enterLoc(ex.to);
    };
    box.appendChild(b);
  });
  // small talk chips near bottom if many
  peeps.slice(0,3).forEach((id,i)=>{
    const b=document.createElement('button');
    b.className='hotspot person';
    b.style.left = (28 + i*22) + '%';
    b.style.top = '78%';
    b.innerHTML = `<span class="hs-icon">💬</span>和${CHARS[id]?.short||id}说话`;
    b.onclick=(e)=>{ e.stopPropagation(); if(!S.freeRoam) return; sfx('click'); talkTo(id); };
    box.appendChild(b);
  });
}

function enterFreeRoam(){
  S.freeRoam=true; awaitingChoice=false; show('action-bar',1); updateHUD(); updateLocBar(); save();
  const box=$('choices'); if(box) box.innerHTML='';
  setSpeaker(null);
  const exits = (EXITS[S.loc]||[]).filter(ex=>ex.babyFuss||canUseExit(ex));
  let tip;
  if(S.ageY<1 && S.loc==='nursery'){
    tip = `（育婴室）\n你还太小，自己走不了多远。\n可以点「闹着要出去」让家人抱你看一眼——然后会被抱回来。\n或点 💠 查看养成、🍂 推进季度。`;
  } else {
    tip = exits.length
      ? `（${LOCS[S.loc]?.name||S.loc}）\n点画面出口移动（标 ⚡ 的会耗体力）。`
      : `（${LOCS[S.loc]?.name||S.loc}）\n想做什么？`;
  }
  $('text').innerHTML = escapeText(tip);
  renderHotspots();
}
function updateLocBar(){
  const L=LOCS[S.loc]; if(!L) return;
  show('loc-bar',1);
  $('loc-name').textContent = `${L.icon} ${L.name}`;
  $('loc-desc').textContent = L.desc||'';
  setBG(L.bg||'bg-room');
}
function enterLoc(id){
  const L=LOCS[id];
  if(!L||!L.unlock){ toast('还不能去那里'); return; }
  if(!phaseAreaAllowed(L.area)){ toast('这个阶段不能去那里'); return; }
  S.loc=id; if(L.tags?.includes('rest')) S.lastSafe=id;
  updateLocBar(); clearPortraits();
  if(tryLocEgg(id)) return;
  const amb = ambientText(id);
  playLines([{text:amb, freeRoam:true}]);
}
function ambientText(id){
  const map = {
    nursery: '熟悉的育婴室。床头有纱帐，雕花的天花板。阳光从缝隙漏进来，在被子上投下晃动的光斑。门外是长廊。',
    ownroom: '属于自己的房间。床铺干净整洁，书桌摆放整齐，窗外花园的微风偶尔吹进。风格与育婴室一脉相承，但多了几分属于自己的宁静。',
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
  else if(act==='next') doNextTime();
};

function openMap(){
  const g=$('map-grid'); g.innerHTML='';
  const phaseLocs = Object.values(LOCS).filter(L=> L.unlock && phaseAreaAllowed(L.area));
  phaseLocs.forEach(L=>{
    const d=document.createElement('button');
    d.className='map-cell'+(S.loc===L.id?' here':'');
    d.innerHTML=`<span class="mc-icon">${L.icon}</span>${L.name}<div class="mc-cost">${(L.st||0)>0?'⚡'+L.st+' · ':''}${L.area}</div>${L.tags?.includes('egg')&&!S.eggs.includes(L.id)?'<div class="mc-tag">？</div>':''}`;
    d.onclick=()=>{
      if(S.loc===L.id){ toast('已经在这里了'); return; }
      if((L.st||0)>0 && !spendST(L.st)) return;
      show('map-overlay',0);
      enterLoc(L.id);
    };
    g.appendChild(d);
  });
  show('map-overlay',1);
}
$('btn-map-close').onclick=()=>show('map-overlay',0);
$('btn-map').onclick=()=>{ if(S.freeRoam) openMap(); else toast('现在不能自由移动'); };

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
    placeChar('sophia',[room,'parlor']); if(!flag('ch_beatrice_leaves')) placeChar('beatrice',[room,'parlor','garden']); if(flag('ch_alice_born')||a>=2) placeChar('alice',[room,'parlor']); 
  }
    if(loc==='parlor'){ placeChar('sophia',['parlor','nursery','dining']); if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['parlor','garden']); if(flag('ch_alice_born')||a>=2) placeChar('alice',['parlor']); if(a>=1) placeChar('claude',['parlor','dining']); }
    if(loc==='dining'){ placeChar('sophia',['dining','parlor']); if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['dining','parlor']); if(flag('ch_alice_born')||a>=2) placeChar('alice',['dining']); placeChar('claude',['dining','parlor']); }
    if(loc==='hallway'){ if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['hallway','garden']); if(a>=0) placeChar('sophia',['hallway','parlor']); if(a>=3) placeChar('claude',['hallway']); if(flag('ch_alice_born')||a>=2) placeChar('alice',['hallway']); }
    if(loc==='garden'){ if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['garden','hallway']); if(flag('ch_alice_born')||a>=2) placeChar('alice',['garden']); if(a>=4) placeChar('sophia',['garden']); }
    if(loc==='study'){ if(a>=1) placeChar('sophia',['study','hallway']); if(flag('ch_alice_born')||a>=3) placeChar('alice',['study']); if(a>=5) placeChar('claude',['study']); }
    if(loc==='training'){ if(a>=4 && !flag('ch_beatrice_leaves')) placeChar('beatrice',['training','garden']); if(a>=6) placeChar('claude',['training']); }
    if(loc==='kitchen'){ placeChar('sophia',['kitchen','dining']); if(a>=2) placeChar('beatrice',['kitchen']); }
    if(loc==='balcony'){ if(a>=2) placeChar('beatrice',['balcony','hallway']); if(flag('ch_alice_born')||a>=3) placeChar('alice',['balcony']); }
    if(loc==='chapel'){ placeChar('sophia',['chapel','hallway']); if(a>=4) placeChar('claude',['chapel']); }
    if(loc==='cellar'){ if(a>=6) placeChar('claude',['cellar']); }
    if(loc==='town'){ /* random passers */ }
    if(loc==='market' && ph==='academy'){ /* market only accessible from academy */ }
    if(loc==='beach'){ if(!flag('ch_beatrice_leaves')) placeChar('beatrice',['beach','town']); if(flag('ch_alice_born')||a>=2) placeChar('alice',['beach']); placeChar('sophia',['beach']); }
  }
  if(ph==='academy'){
    if(loc==='dorm'){ placeChar('emma',['dorm','cafeteria']); if(flag('met_noelle')) placeChar('noelle',['dorm','library']); }
    if(loc==='library'||loc==='clocktower'){ placeChar('noelle',['library','cafeteria']); if(flag('met_noelle')) placeChar('emma',['library']); }
    if(loc==='cafeteria'){ placeChar('emma',['cafeteria','dorm']); if(flag('met_noelle')) placeChar('noelle',['cafeteria']); if(flag('met_ajun')) placeChar('ajun',['cafeteria']); if(flag('ch_helena')) placeChar('helena',['cafeteria']); }
    if(loc==='water_class'){ if(flag('met_noelle')) placeChar('noelle',['water_class','library']); placeChar('emma',['water_class']); placeChar('anna',['water_class','cafeteria']); }
    if(loc==='ice_class'||loc==='flowerhouse'){ if(flag('met_aino')||true) placeChar('aino',['ice_class','training_field']); placeChar('hol',['ice_class','library']); }
    if(loc==='training_field'){ if(flag('met_aino')) placeChar('aino',['training_field']); placeChar('beatrice',['training_field']); }
    if(loc==='memorial'){ placeChar('charlotte',['memorial']); if(flag('ch_tree')){ placeChar('beatrice',['memorial']); placeChar('alice',['memorial']); } }
    if(loc==='auditorium'){ placeChar('fashen',['auditorium','cafeteria']); placeChar('hol',['auditorium','ice_class']); placeChar('anna',['auditorium','water_class']); }
  }
  if(ph==='journey'||ph==='finale'){
    if(loc==='jikan'){ placeChar('ji',['jikan']); placeChar('jilan',['jikan']); }
    if(loc==='northforest'){ /* monsters */ }
    if(loc==='road'){ /* travelers */ }
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
      [{ch:'beatrice',emo:'happy',speaker:'贝阿特丽丝',text:'妹妹！妹妹！看我！——妈妈说要轻一点……那我轻轻的！'}, {text:'她用胖乎乎的手指戳戳我的脸，又怕弄疼，缩了回去。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'happy',speaker:'贝阿特丽丝',text:'希尔维亚要快点长大！这样我们就能一起玩布偶了！'}, {text:'两岁的姐姐已经在发号施令了。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'happy',speaker:'贝阿特丽丝',text:'这是我的妹妹！谁都不许抱走！'}, {text:'她张开小小的胳膊挡在床边，理直气壮。', love:'beatrice', loveD:1}],
    ] : [
      [{ch:'beatrice',emo:'happy',speaker:'贝阿特丽丝',text:a<6?'希尔维亚！看我转圈——哇！地板好滑！':'听好了！贝阿特丽丝大人今天的训练量翻倍！'}, {text:a<6?'姐姐摔了个屁股墩，又立刻爬起来，笑得没心没肺。':'她说完就去练武场了，木剑带起的风差点掀翻花瓶。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'happy',speaker:'贝阿特丽丝',text:'妹妹要听姐姐的话！这是维斯特利亚家的规矩！……我刚定的。'}, {text:'理直气壮的样子意外地有说服力。大概只有她信。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:a<10?'火焰兔子！再差一点就成功了！':'论文第三款……希尔维亚你记性好，帮我看看！'}, {text:a<10?'窗帘安全地活过了今天。大概。':'她的桌上铺满草稿，笔帽被咬出牙印。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'happy',speaker:'贝阿特丽丝',text:'晚上想吃松饼！我去跟厨房说！贝阿特丽丝大人批准了！'}, {text:'她风风火火跑走了。厨房的人大概又要头疼。', love:'beatrice', loveD:1}],
      [{ch:'beatrice',emo:'normal',speaker:'贝阿特丽丝',text:'……希尔维亚。你要是被谁欺负了，告诉我。我罩着你。'}, {text:'语气难得认真。我点点头。', love:'beatrice', loveD:1, know:'beatrice', knowD:2}],
    ],
    alice: a<2 ? [
      [{text:'爱丽丝还太小，只会握住我的手指，眼睛亮亮的。', love:'alice', loveD:1}],
    ] : [
      [{ch:'alice',emo:'normal',speaker:'爱丽丝',text:'……姐姐大人。'}, {ch:'alice',emo:'smile',text:a<5?'……花，开了。':'……今天的风，很软。', love:'alice', loveD:1}],
      [{ch:'alice',emo:'shy',speaker:'爱丽丝',text:'……姐姐大人。可以……坐近一点吗。'}, {text:'她轻轻拉了拉我的袖子。动作轻得像怕惊动什么。', love:'alice', loveD:1, know:'alice', knowD:3}],
      [{ch:'alice',emo:'normal',speaker:'爱丽丝',text:a<8?'……请教我认字。':'……姐姐大人发呆的时候，在想什么？'}, {text:a<8?'她学得很快，快得有点犯规。':'我随口说「大地为什么会拉东西」。她眼睛亮了一下。', love:'alice', loveD:1, know:'alice', knowD:4}],
      [{ch:'alice',emo:'smile',speaker:'爱丽丝',text:'……贝阿特丽丝姐姐又在炫耀了。……不过，我喜欢。'}, {text:'淡淡的语气，内容却意外地有自己的想法。', love:'alice', loveD:1}],
      [{ch:'alice',emo:'shy',speaker:'爱丽丝',text:'……姐姐大人今天也……很好看。'}, {text:'说完就低头。耳尖有一点点红。', love:'alice', loveD:1}],
    ],
    sophia: a<1 ? [
      [{ch:'sophia',emo:'normal',speaker:'索菲亚',text:'我的小宝贝……睡吧，妈妈在。'}, {text:'摇篮曲很轻。世界只剩下心跳和奶香。', love:'sophia', loveD:1}],
      [{ch:'sophia',speaker:'索菲亚',text:'眼睛是蓝的呢……像你父亲。'}, {text:'她用指背碰了碰我的脸颊。'}, {text:'我还不会说话，只能看她。', love:'sophia', loveD:1}],
    ] : [
      [{ch:'sophia',emo:'normal',speaker:'索菲亚',text:a<6?'希尔维亚，有好好吃饭吗？':'希尔维亚，最近有没有太拼命练魔法？'}, {text:'母亲的手拂过我的头发。很轻，很暖。', love:'sophia', loveD:1}],
      [{ch:'sophia',speaker:'索菲亚',text:'院子里的鸢尾开了。你父亲从前很喜欢。……别告诉他我说过。'}, {text:'她笑起来的时候，眼睛弯弯的。', love:'sophia', loveD:1, know:'sophia', knowD:3}],
      [{ch:'sophia',speaker:'索菲亚',text:'三姐妹在一起的时候，家里最吵，也最像家。'}, {text:'我点点头。这句话我想记住。', love:'sophia', loveD:1}],
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
    aino: [
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
  };

  const pool = pools[id];
  if(pool && pool.length){
    const lines = pick(pool).map(L=>{
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
  // 霁馆
  dojo_foot:{id:'dojo_foot', name:'步法', phase:['journey'], teacher:'霁馆主', needAge:13,
    stat:{body:4}, st:3, desc:'生根、横移、走着砍。', skillAt:2, skill:{id:'root_step', name:'生根步', type:'passive', desc:'被击退距离减少。'}},
  dojo_blade:{id:'dojo_blade', name:'挥剑', phase:['journey'], teacher:'霁馆主', needAge:13,
    stat:{body:3, mana:1}, st:3, desc:'不用力的送刀，剑是活的。', skillAt:2, skill:{id:'soft_cut', name:'送刀', type:'active', desc:'低耗刀势，附带少量魔力。'}},
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
    '霁馆主':'ji',
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
    if(S.loc==='jikan' || S.loc==='training'){
      lines.push({text:'竹剑的手感沉了些。身体记得住。', exp:20});
      S.atk += 0.1; // accumulates
    }
  }
  if(S.stats){ addStat('mana', 1); addStat('body', S.loc==='training'||S.loc==='jikan'||S.loc==='training_field'?2:1); }
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
  playLines([{text:`时间来到 ${dateStr()}。`, do:()=>checkStoryGates(), freeRoam:true}]);
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
        {text:'橘猫又来了。诺艾儿笨拙地伸手——又缩回去。'},
        {ch:'noelle',speaker:'诺艾儿',text:'……它看我了。像在审判。'},
        {text:'你把猫放在她膝盖上。她的表情是小心翼翼的欢喜。', love:'noelle', loveD:1, freeRoam:true}
      ]);
    },
    flowerhouse:()=>{
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
  setBG('bg-pick');
  show('pick-screen',1); show('game-screen',1);
  const g=$('pick-grid'); g.innerHTML='';
  picks.forEach(p=>{
    const d=document.createElement('div');
    d.className='pick-card';
    d.innerHTML=`<div class="tag">${p.tag||''}</div><h3>${p.name}</h3><p>${p.desc}</p>`;
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
  sfx('level');
  updateHUD(); save();
  playLines([
    {text:`时间恢复流动。\n你获得了「${p.name}」。\n${p.desc}`},
    {text:'（可以继续行动了。）', freeRoam:true}
  ]);
}

// ========== BATTLE (simple) ==========
function startBattle(cfg, done){
  B = {
    name:cfg.name||'魔物', emoji:cfg.emoji||'🐺',
    hp:cfg.hp||30, mhp:cfg.hp||30, atk:cfg.atk||5, exp:cfg.exp||20, gold:cfg.gold||3,
    done
  };
  setBG('bg-battle'); show('battle-screen',1);
  $('b-emoji').textContent=B.emoji; $('b-ename').textContent=B.name;
  $('b-log').innerHTML=`遭遇了 ${B.name}！`;
  renderBattle();
}
function renderBattle(){
  $('b-ehp').style.width=(B.hp/B.mhp*100)+'%';
  $('b-ehp-num').textContent=`${Math.max(0,B.hp)}/${B.mhp}`;
  const acts=$('b-actions'); acts.innerHTML='';
  const skills = [
    {name:'水球术', cost:4, dmg:()=>8+S.mag*0.4, cls:'water'},
    {name:'冰晶术', cost:6, dmg:()=>12+S.mag*0.6, cls:'ice'},
  ];
  if(hasSkill('mana_cycle')){/* passive */}
  skills.forEach(sk=>{
    const b=document.createElement('button'); b.className='choice';
    b.textContent=`${sk.name}（MP ${sk.cost}）`;
    b.disabled = S.mp<sk.cost;
    b.onclick=()=>battleAct(sk);
    acts.appendChild(b);
  });
  const atk=document.createElement('button'); atk.className='choice'; atk.textContent='普通攻击';
  atk.onclick=()=>battleAct({name:'攻击', cost:0, dmg:()=>S.atk+2});
  acts.appendChild(atk);
  const run=document.createElement('button'); run.className='choice'; run.textContent='逃跑';
  run.onclick=()=>{ show('battle-screen',0); toast('逃跑成功'); if(B.done) B.done(); B=null; if(S.freeRoam) enterFreeRoam(); };
  acts.appendChild(run);
}
function battleAct(sk){
  if(sk.cost) S.mp-=sk.cost;
  let dmg = Math.floor(sk.dmg());
  if(hasSkill('mana_cycle') && sk.cost>0){
    const bonus = dmg * (sk.cost / Math.max(1,S.mmp));
    dmg = Math.floor(dmg + bonus);
    S.mp = clamp(S.mp + Math.min(dmg, 20), 0, S.mmp); // simplified return
  }
  B.hp -= dmg;
  $('b-log').innerHTML += `<br>你的${sk.name}造成 ${dmg} 伤害！`;
  sfx('magic');
  if(B.hp<=0){
    $('b-log').innerHTML += `<br>击败了 ${B.name}！经验+${B.exp}`;
    addExp(B.exp); S.gold+=B.gold||0; updateHUD();
    setTimeout(()=>{ show('battle-screen',0); const d=B.done; B=null; if(d) d(); else if(S.freeRoam) enterFreeRoam(); }, 600);
    return;
  }
  // enemy turn
  const ed = Math.max(1, B.atk - S.pdef);
  S.hp = clamp(S.hp-ed,0,S.mhp);
  $('b-log').innerHTML += `<br>${B.name} 反击！受到 ${ed} 伤害。`;
  updateHUD();
  if(S.hp<=0){
    S.deaths++; S.hp=1;
    $('b-log').innerHTML += `<br>……意识模糊。被人救了回来。`;
    setTimeout(()=>{ show('battle-screen',0); B=null; S.loc=S.lastSafe; enterFreeRoam(); toast('重伤撤回'); }, 800);
    return;
  }
  renderBattle();
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
  show('duel-screen',1); setBG('bg-duel');
  $('duel-info').innerHTML=`对手：${CHARS[id]?.name||id}<br>难度：★☆☆☆☆`;
  const log=$('duel-log'); log.innerHTML='决斗开始！';
  const acts=$('duel-actions'); acts.innerHTML='';
  let ehp=40+ (S.know[id]||90), php=S.hp;
  const turn = ()=>{
    acts.innerHTML='';
    ['冰晶术','水球术','普通攻击'].forEach(n=>{
      const b=document.createElement('button'); b.className='choice'; b.textContent=n;
      b.onclick=()=>{
        const d=n==='冰晶术'?15+S.mag*0.3:n==='水球术'?10+S.mag*0.2:S.atk+3;
        ehp-=d; log.innerHTML+=`<br>你的${n}！伤害${Math.floor(d)}`;
        if(ehp<=0){ winDuel(id); return; }
        const ed=5+Math.random()*8; php-=ed; log.innerHTML+=`<br>${CHARS[id].short}反击！-${Math.floor(ed)}`;
        if(php<=0){ log.innerHTML+=`<br>失败……`; setTimeout(()=>{show('duel-screen',0); enterFreeRoam();},800); return; }
        turn();
      };
      acts.appendChild(b);
    });
  };
  turn();
}
function winDuel(id){
  const key=id+'_cur';
  if(!S.duelWins.includes(key)) S.duelWins.push(key);
  const rew = DUEL_REWARDS[id+'_11']||DUEL_REWARDS[id+'_9']||DUEL_REWARDS[id+'_14']||DUEL_REWARDS[id+'_cur']||{id:'duel_'+id,name:'战斗经验',desc:'实战感觉提升。'};
  if(rew.id && !hasSkill(rew.id)) addSkill(rew.id);
  ach('virtual_first');
  $('duel-log').innerHTML+=`<br>🎉 胜利！获得：${rew.name}`;
  $('duel-actions').innerHTML=`<button class="choice" onclick="document.getElementById('duel-screen').classList.add('hidden');enterFreeRoam()">确认</button>`;
  addExp(30); sfx('ok');
}

// ========== PANEL ==========

function openStatsPanel(){
  if(!S.stats) S.stats = {body:5, mind:15, mana:10, charm:8};
  const body = $('stats-body');
  if(!body){ openPanel('status'); return; }
  // 主角立绘
  const sE = flag('named');
  const sAlias = S.alias === '眷寒渔';
  const sSrc = sE ? resolvePortrait('sylvia', sAlias ? 'serious' : 'normal') : null;
  const portraitHTML = sSrc ? `<div class="stats-portrait"><img src="${sSrc}" style="max-width:160px;max-height:200px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.3)"/></div>` : '';
  const meta = {
    body:{name:'体能', tip:'剑术、奔跑、持剑。影响近战与负重耐性。'},
    mind:{name:'心智', tip:'学习、记忆、理论。影响课程收益与了解度获取。'},
    mana:{name:'魔力适性', tip:'导引与塑形。影响法术稳定与魔力成长。'},
    charm:{name:'气质', tip:'仪态与人情。影响交谈、好感与交涉。'},
  };
  body.innerHTML = `${portraitHTML}<div class="stat-orb">${['body','mind','mana','charm'].map(k=>{
    const v = Math.min(100, S.stats[k]|0);
    return `<div class="stat-item ${k}"><div class="si-top"><span class="si-name">${meta[k].name}</span><span class="si-val">${v}</span></div><div class="si-bar"><i style="width:${v}%"></i></div><div style="font-size:11px;opacity:.55;margin-top:6px">${meta[k].tip}</div></div>`;
  }).join('')}</div>
  <div class="stat-courses"><b style="color:var(--gold)">课程进度</b><br>${
    Object.keys(S.courses||{}).length
      ? Object.entries(S.courses).map(([id,st])=>{ const c=COURSES[id]; return `• ${c?c.name:id}　Lv.${st.lv}`; }).join('<br>')
      : '尚未开始系统课程。点底部「课程」开始。'
  }</div>`;
  show('stats-overlay', 1);
  sfx('open');
}

function openPanel(tab){
  show('panel',1); sfx('open');
  const tabs=[['status','状态'],['skills','技能'],['tasks','任务'],['prof','人物'],['inv','背包'],['ach','成就'],['mem','记忆']];
  $('panel-tabs').innerHTML = tabs.map(([k,n])=>`<button class="ptab${(tab||'status')===k?' on':''}" data-t="${k}">${n}</button>`).join('');
  $('panel-tabs').onclick=e=>{ const t=e.target.dataset.t; if(t) openPanel(t); };
  const body=$('panel-body');
  tab = tab||'status';
  if(tab==='status'){
    body.innerHTML=`<div class="p-stat">
      <div><b>名字</b> ${S.alias||S.name}</div><div><b>年龄</b> ${ageStr()}</div>
      <div><b>等级</b> Lv.${S.lv}</div><div><b>等阶</b> ${tierName()}</div>
      <div><b>经验</b> ${S.exp}/${S.next}</div><div><b>日期</b> ${dateStr()}</div>
      <div><b>生命</b> ${S.hp}/${S.mhp}</div><div><b>魔力</b> ${S.mp}/${S.mmp}</div>
      <div><b>体力</b> ${S.st}/${S.mst}</div><div><b>金币</b> ${S.gold}</div>
      <div><b>攻击</b> ${Math.floor(S.atk)}</div><div><b>魔力值</b> ${Math.floor(S.mag)}</div>
      <div><b>物抗</b> ${S.pdef}</div><div><b>法抗</b> ${S.mdef}</div>
      <div><b>亲和</b> ❄️冰 · 💧水</div><div><b>阶段</b> ${S.phase}</div>
    </div>
    <p style="margin-top:12px;font-size:12px;opacity:.75">养成四维请点 HUD 的 <b>💠</b> 打开独立面板。<br>「勇者之赐」已用 ${S.picksDone.length}/7 次</p>`;
  } else if(tab==='skills'){
    if(!S.skills.length) body.innerHTML='<p style="opacity:.6">尚未获得特殊技能。</p>';
    else body.innerHTML = S.skills.map(id=>{
      const p=ALL_PICKS[id]||Object.values(DUEL_REWARDS).find(x=>x.id===id)||{name:id,desc:''};
      // 中文名映射
      const cnNames={virtual_duel:'虚拟决斗',ice_sense:'寒息感知',water_veil:'水之帷幕',quiet_mind:'静心',baby_talk:'天籁初声',mana_sip:'魔力小啜',silk_thread:'千缕银丝',ice_palace:'冰晶宫殿',multi_cast:'二重咏唱',frost_armor:'霜铠',deep_read:'深读',mirror_ice:'镜冰',wind_step_s:'残影步（简）',heal_touch:'温手',mana_cycle:'魔战循环',domain_frost:'霜域',perfect_cast:'无咏唱具现',fate_eye:'因果薄片',sword_mana:'魔剑同化',memory_link:'记忆连丝',zero_field:'绝对零度逼近',temp_sense:'温度感知',wind_afterimage:'风行残像',mana_calc:'魔力精算',root_ice:'生根之冰',noble_bearing:'公爵气度',lullaby:'摇篮曲',etiquette:'贵族仪态',water_ball:'水球术',basic_guard:'基本防御架',theory_note:'理论笔记',water_veil_s:'水膜',ice_sphere:'完美冰球',root_step:'生根步',soft_cut:'送刀'};
      const displayName = cnNames[id] || p.name || id;
      return `<div class="p-skill"><div class="sk-name">${displayName}</div><div class="sk-desc">${p.desc||''}</div></div>`;
    }).join('') + (hasSkill('virtual_duel')?`<button class="tbtn" style="margin-top:10px" id="btn-duel">⚔️ 进入虚拟决斗</button>`:'');
    setTimeout(()=>{ const b=$('btn-duel'); if(b) b.onclick=()=>{ show('panel',0); openDuelMenu(); }; },0);
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
      return `<div class="p-task${st.done?' done':''}"><b>${st.done?'✅':'☆'} ${t.name}</b><br>${t.desc}<br><span style="opacity:.6">奖励：经验×${t.exp}${t.max?` · 进度 ${st.prog||0}/${t.max}`:''}</span></div>`;
    }).join('');
  } else if(tab==='prof'){
    const ids = Object.keys(S.know).concat(Object.keys(S.love)).filter((v,i,a)=>a.indexOf(v)===i);
    if(!ids.length) body.innerHTML='<p style="opacity:.6">图鉴尚空。多与人接触吧。</p>';
    else body.innerHTML = ids.map(id=>{
      const c=CHARS[id]||{short:id,name:id}; const k=S.know[id]||0; const l=S.love[id]||0;
      const hearts='♥'.repeat(l)+'♡'.repeat(5-l);
      const pf = PORTRAIT_FILES[`${id}_normal`];
      return `<div class="p-prof"><div class="av">${pf?`<img src="${pf}"/>`:(CSS_CHARS[id]?.[1]||'👤')}</div>
        <div class="info"><div class="nm">${c.name||c.short}</div>
        <div class="meta">${c.role||''} · 了解度 ${k}%</div>
        <div class="hearts">${hearts}</div>
        <div class="know-bar"><i style="width:${k}%"></i></div></div></div>`;
    }).join('');
  } else if(tab==='inv'){
    const slots = S.inv.map(it=>`<div class="inv-slot filled">${it.icon||'📦'}<br>${it.name}<br><span style="opacity:.6">${it.desc||''}</span></div>`).join('');
    body.innerHTML=`<div class="p-inv">${slots || '<div class="inv-slot">空</div>'}</div>
      <p style="margin-top:8px;opacity:.6;font-size:12px">背包 ${S.inv.length}/50 · 系统收纳（单手可握之物）</p>`;
  } else if(tab==='ach'){
    const unlocked = ACH.filter(a=>S.ach[a.id]);
    const lockedN = ACH.length - unlocked.length;
    body.innerHTML = (unlocked.length? unlocked.map(a=>`<div class="p-ach">🏆 <b>${a.name}</b><br>${a.desc}<br><span style="opacity:.6">奖励：${a.reward}</span></div>`).join('') : '<p style="opacity:.6">尚未解锁成就。</p>')
      + (lockedN? `<p style="margin-top:12px;opacity:.5;font-size:12px">还有 ${lockedN} 个隐藏成就未解锁</p>` : '');
  } else if(tab==='mem'){
    if(!hasSkill('ice_palace')) body.innerHTML='<p style="opacity:.6">尚未构建冰晶宫殿。</p>';
    else if(!S.memories.length) body.innerHTML='<p style="opacity:.6">冰镜空空。冻结记忆以保存场景。</p><button class="tbtn" id="btn-freeze">❄ 冻结当前场景</button>';
    else body.innerHTML = S.memories.map((m,i)=>`<div class="p-skill"><div class="sk-name">冰镜 ${i+1} · ${m.title}</div><div class="sk-desc">${m.desc}</div></div>`).join('')+`<button class="tbtn" id="btn-freeze">❄ 冻结当前场景</button>`;
    setTimeout(()=>{ const b=$('btn-freeze'); if(b) b.onclick=()=>{
      const n=flag('palace_today')||0; if(n>=5){ toast('今日冻结次数已用尽'); return; }
      flag('palace_today', n+1);
      S.memories.push({title:dateStr()+' · '+(LOCS[S.loc]?.name||''), desc:'冻结的日常。细节清晰如昨。'});
      // raise know of people here
      whoIsHere().forEach(id=>know(id, 2));
      toast('场景已冻结'); openPanel('mem');
    }; },0);
  }
}
$('btn-panel').onclick=()=>openPanel('status');
$('btn-panel-close').onclick=()=>show('panel',0);
if($('btn-stats')) $('btn-stats').onclick=()=>openStatsPanel();
if($('btn-stats-close')) $('btn-stats-close').onclick=()=>show('stats-overlay',0);


// ========== STORY GATES ==========
function checkStoryGates(){
  const queue = [];
  // 第一卷 公爵篇（按日历触发）
  if(!flag('ch_first_word') && dateAtLeast(0,7)){ flag('ch_first_word',1); queue.push('s_first_word'); }
  if(!flag('ch_alice_born') && dateAtLeast(2,6)){ flag('ch_alice_born',1); queue.push('s_alice_born'); }
  if(!flag('ch_child_days') && flag('ch_alice_born') && dateAtLeast(3,9)){ flag('ch_child_days',1); queue.push('s_child_days'); }
  if(!flag('mana_awakened') && !flag('ch_mana_scene') && dateAtLeast(3,9)){ flag('ch_mana_scene',1); queue.push('s_mana_awaken'); }
  if(!flag('ch_yaoshen') && dateAtLeast(4,12)){ flag('ch_yaoshen',1); queue.push('s_yaoshen'); }
  if(!flag('ch_sisters_grow') && dateAtLeast(5,6)){ flag('ch_sisters_grow',1); queue.push('s_sisters_grow'); }
  if(!flag('ch_reno_arrive') && dateAtLeast(6,3)){ flag('ch_reno_arrive',1); queue.push('s_reno_arrive'); }
  if(!flag('ch_alice_affinity') && dateAtLeast(7,3)){ flag('ch_alice_affinity',1); queue.push('s_alice_affinity'); }
  if(!flag('ch_beatrice_day') && dateAtLeast(7,12)){ flag('ch_beatrice_day',1); queue.push('s_beatrice_day'); }
  if(!flag('ch_micro') && dateAtLeast(8,6)){ flag('ch_micro',1); queue.push('s_micro'); }
  if(!flag('ch_beatrice_leaves') && dateAtLeast(10,3)){ flag('ch_beatrice_leaves',1); queue.push('s_beatrice_leaves'); }
  if(!flag('ch_academy') && dateAtLeast(12,3)){ flag('ch_academy',1); queue.push('s_academy_start'); }
  // 第二卷 学院篇（开学典礼后依次触发）
  if(S.phase==='academy' && !flag('ch_opening_ceremony') && flag('ch_academy')){ flag('ch_opening_ceremony',1); queue.push('s_opening_ceremony'); }
  if(S.phase==='academy' && !flag('met_noelle') && flag('ch_opening_ceremony')){ flag('met_noelle',1); queue.push('s_noelle_meet'); }
  // 初遇艾诺：接在诺艾儿剧情之后（第二章）
  if(S.phase==='academy' && !flag('met_aino') && flag('met_noelle')){ flag('met_aino',1); queue.push('s_aino_meet'); }
  // 夏洛特赌约：初遇艾诺之后（第二章）
  if(S.phase==='academy' && !flag('met_charlotte') && flag('met_aino')){ flag('met_charlotte',1); queue.push('s_charlotte_meet'); }
  // 海伦娜访客（第三章，期中考试后第二周）
  if(S.phase==='academy' && !flag('ch_helena') && S.ageY>=13){ flag('ch_helena',1); queue.push('s_helena'); }
  // 与艾诺比试：海伦娜走后下一个季度才触发（第四章）
  if(S.phase==='academy' && flag('ch_helena') && !flag('ch_aino_sparring')){
    const hs = flag('helena_left_season'), hy = flag('helena_left_year');
    if(hs!=null && hy!=null && (S.year*4+S.season > hy*4+hs+1)){ flag('ch_aino_sparring',1); queue.push('s_aino_sparring'); }
  }
  // 阿琼：比试之后（第四章）
  if(S.phase==='academy' && !flag('met_ajun') && flag('ch_aino_sparring')){ flag('met_ajun',1); queue.push('s_ajun'); }
  if(S.phase==='academy' && !flag('ch_tree') && S.ageY>=15){ flag('ch_tree',1); queue.push('s_tree'); }
  if(S.phase==='academy' && !flag('ch_beach') && S.ageY>=15){ flag('ch_beach',1); queue.push('s_beach'); }
  if(S.phase==='academy' && !flag('ch_star') && S.ageY>=15){ flag('ch_star',1); queue.push('s_star_festival'); }
  if(S.phase==='academy' && !flag('did_turnpoint') && S.ageY>=15){ flag('did_turnpoint',1); queue.push('s_turnpoint'); }
  // 旅途篇
  if((S.phase==='journey'||S.phase==='finale') && !flag('arrived_jikan') && S.dayCount>0){ flag('arrived_jikan',1); queue.push('s_jikan_arrive'); }
  if((S.phase==='journey'||S.phase==='finale') && (!S.alias||S.alias!=='眷寒渔') && !flag('ch_black_name')){ flag('ch_black_name',1); queue.push('s_black_name'); }
  if(!queue.length) return false;
  // 逐个触发：第一个立即运行，后续在场景结束后自动衔接
  runSceneQueue(queue, 0);
  return true;
}
function runSceneQueue(queue, idx){
  if(idx >= queue.length) return;
  const id = queue[idx];
  // 用 playLines 的 done 回调衔接下一个场景
  const sc = SCENES[id];
  if(!sc){ runSceneQueue(queue, idx+1); return; }
  currentScene = id;
  S.freeRoam = false;
  awaitingChoice = false;
  lineCB = null;
  show('action-bar', 0);
  const box = $('choices'); if(box) box.innerHTML = '';
  show('game-screen', 1);
  if(sc.bg) setBG(sc.bg);
  if(sc.phase) S.phase = sc.phase;
  if(sc.loc){ S.loc = sc.loc; updateLocBar(); }
  updateHUD();
  const nextCb = idx+1 < queue.length ? ()=>runSceneQueue(queue, idx+1) : null;
  const go = ()=>{
    // Override the done callback to chain to next scene
    const origLines = sc.lines || [];
    playLines(origLines, ()=>{
      if(nextCb) nextCb();
      else if(!S.freeRoam) enterFreeRoam();
    });
  };
  if(sc.card) showCard(sc.card.vol, sc.card.t, sc.card.s, go);
  else go();
  save();
}

// ========== SCENES ==========
const SCENES = {};
function runScene(id){
  const sc = SCENES[id];
  if(!sc){ console.warn('missing scene', id); toast('剧情缺失：'+id); enterFreeRoam(); return; }
  currentScene = id;
  S.freeRoam = false;
  awaitingChoice = false;
  lineCB = null;
  show('action-bar', 0);
  const box = $('choices'); if(box) box.innerHTML = '';
  show('game-screen', 1);
  if(sc.bg) setBG(sc.bg);
  if(sc.phase) S.phase = sc.phase;
  if(sc.loc){ S.loc = sc.loc; updateLocBar(); }
  updateHUD();
  const go = ()=> playLines(sc.lines || [], sc.done);
  if(sc.card) showCard(sc.card.vol, sc.card.t, sc.card.s, go);
  else go();
  save();
}

// ----- PROLOGUE -----
SCENES.s_start = {
  bg:'bg-img-title bg-title', phase:'prologue',
  card:{vol:'第一卷 公爵篇', t:'第一章', s:'银与蓝'},
  lines:[
    {text:'窗外是灰蒙蒙的天。\n我靠在椅背上，视线落在操场边缘的那棵老槐树上。'},
    {text:'五月了，槐花应该快开了吧。'},
    {speaker:'班主任', text:'眷寒渔。这道题。'},
    {text:'我扫了一眼黑板，报出答案。坐下去。\n周围有人在小声讨论游戏和番剧。同桌问我要不要一起看——我摇摇头。'},
    {text:'不是不感兴趣。只是觉得麻烦。'},
    {text:'放学后，我一个人走在回家的路上。\n街边奶茶店排着队。有情侣牵着手走过。'},
    {text:'成绩单上我的名字总在前面。朋友不多。我不觉得不好。只是偶尔会想——\n我好像和周围的世界隔着一层什么。'},
    {text:'过马路的时候，绿灯亮着。我迈出一步——'},
    {text:'余光里有什么在逼近。\n尖锐的刹车声。', sfx:'bad'},
    {text:'然后世界暗了下来。'},
    {bg:'bg-void', text:'意识很模糊。温暖。黑暗。被什么柔软的东西包裹着。'},
    {text:'有声音传来，很遥远，像隔着一层水。\n我想动，但身体不听使唤。'},
    {text:'压力。被推挤着。被迫向前。\n光——刺眼的光涌入眼帘。'},
    {text:'冷空气灌进肺里，我本能地张嘴——\n「哇啊——！」'},
    {text:'……这是婴儿的哭声吧。我的？'},
    {text:'意识猛然清醒。视线模糊，只能看到晃动的色块。\n有人抱起了我，怀抱温暖，带着淡淡香气。'},
    {text:'我……转生了？\n这个念头浮现时，我并没有太多惊慌。\n反正事情已经变成这样了。就这样吧。'},
    {sfx:'open', text:'叮。\n一声清脆的提示音在脑海中响起。眼前浮现半透明面板。'},
    {do:()=>sysPopup('✧ SYSTEM ✧', '📋 状态　🎒 背包　🗺️ 地图<br>📖 图鉴　📜 任务<br><br>只有你能看见。')},
    {text:'这是……游戏系统？\n以新生儿的视力，周围模糊，但面板清晰得不可思议。'},
    {text:'状态面板——\n名字：未命名　性别：女　年龄：0岁0天\n等级 Lv.1　HP 8/8　MP 12/12\n亲和：❄️冰（赋）· 💧水（基础）'},
    {text:'性别：女。\n……嗯。女。\n我转生成女孩了。'},
    {text:'说实话，我以为会有更大反应。\n但实际上只是「哦」了一声。不是装的。'},
    {text:'反正已经这样了。'},
    {ch:'sophia', emo:'normal', speaker:'？？？', text:'（温柔的女声，听不懂内容，但语调很开心。）'},
    {text:'抱着我的女人在轻声说话。另有一个低沉稳重的男声。\n一只大手覆上我的额头，极轻极轻。'},
    {text:'听不懂。但莫名觉得安心。', ach:'born_again', love:'sophia', loveD:1},
    {do:()=>{ know('sophia',20); know('claude',15); love('claude',1); S.name='希尔维亚·维斯特利亚'; }},
    {text:'图鉴更新：母亲·索菲亚　父亲·克劳德。'},
    {text:'接下来的日子在吃与睡中流过。\n视力慢慢恢复。房间很大，装潢精致——不是普通人家。'},
    {bg:'bg-room', loc:'nursery', text:'大约一个月大时，我被抱出了房间。'},
    {ch:'sophia', speaker:'索菲亚', text:'希尔维亚……我的小希尔维亚。'},
    {do:()=>{ S.name='希尔维亚·维斯特利亚'; flag('named',1); updateHUD(); }},
    {text:'系统上的「未命名」变成了「希尔维亚·维斯特利亚」。\n维斯特利亚公爵家。阿斯拉王国。次女。'},
    {text:'起居室里有个约两岁的金发小女孩。'},
    {ch:'beatrice', emo:'happy', slot:'left', speaker:'贝阿特丽丝', text:'妈妈！妹妹！！'},
    {ch:'sophia', slot:'right', speaker:'索菲亚', text:'轻一点，贝阿特丽丝。希尔维亚还很小呢。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'软软的！妹妹好可爱！！', love:'beatrice', loveD:1, know:'beatrice', knowD:25, },
    {text:'她把我当成珍宝。理直气壮地挡在仆人面前：「不行！这是我的妹妹！」'},
    {text:'我盯着天花板。\n有魔法。有公爵。有系统。\n转生成公爵千金的开局？'},
    {text:'然后呢？复仇？称霸？拯救世界？\n……想不出来。\n我前世就不是有野心的人。'},
    {text:'系统给了，就看看。\n转生成女孩，就当女孩。\n公爵千金？听起来生活不错。\n至于以后——以后再说吧。'},
    {text:'日子在吃与睡里流过。\n背包是空的。地图上只有房间一个亮点。任务栏也是空的。\n我试着把手边的枕头「收纳」——没有反应。大概婴儿没有权限。'},
    {text:'有一次女仆给我换尿布。\n视野里是自己的身体——粉嫩的婴儿皮肤，细细的手脚。\n以及，确实是女孩子的身体。'},
    {text:'……所以我真的变成女孩子了啊。\n以后上厕所得坐着？会来那个？\n思绪发散到一半就停住了——因为我发现自己根本没多少抵触。'},
    {text:'为什么呢。\n……算了，想不通就不想了。反正也不是什么坏事。\n我闭上眼睛，继续睡觉。'},
    {text:'我看了看自己胖乎乎的小手。\n……算了，不深究了。系统爱叫什么就叫什么吧。'},
    {text:'（自由行动开启）\n\n· 点画面上的「门/出口」在相邻房间移动（育婴室→长廊→……）\n· 下方：交谈 / 修行 / 学习 / 休息 / 🍂下个季度\n· 「总览」可看全部已解锁地点\n· 彩蛋藏在房间里，多走走。', phase:'childhood', freeRoam:true}
  ]
};

SCENES.s_first_word = {
  bg:'bg-room',
  lines:[
    {text:'五个月大时，任务系统第一次亮了起来——「第一声」：说出你人生中的第一个词。'},
    {text:'日常对话我已经能听懂六七成。婴儿的大脑学语言真快。\n但「说」是另一回事。声带还没发育完全。'},
    {text:'贝阿特丽丝现在两岁半，每天教我叫「姐姐」。一遍一遍。\n如果第一个词叫她，她肯定会高兴坏——但她已经够霸道了。'},
    {text:'七个月大的那天下午，她又趴在床边叽叽喳喳。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'希尔维亚！你什么时候才会说话呀？快点叫姐姐！姐——姐——'},
    {text:'金色的头发在阳光下发亮。蓝色的眼睛圆溜溜的。\n认真念「姐姐」的样子，意外地可爱。'},
    {text:'我不知道哪根筋搭错了。嘴巴自己动了——'},
    {speaker:'希尔维亚', text:'……贝蒂。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'你、你说什么？'},
    {speaker:'希尔维亚', text:'贝……蒂。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'她叫我了！！！妈妈！！爸爸！！希尔维亚会说话了！！', sfx:'ok'},
    {text:'……我为什么要叫她的小名啊。明明不想让她得意的。\n算了，反正已经叫了。', task:'first_word', love:'beatrice', loveD:1},
    {text:'那天晚上全家人都来了。父亲难得早回。'},
    {ch:'sophia', speaker:'索菲亚', text:'希尔维亚，能叫妈妈吗？'},
    {speaker:'希尔维亚', text:'……妈妈。'},
    {text:'母亲的眼眶一下子红了。'},
    {ch:'claude', speaker:'克劳德', text:'爸爸呢？'},
    {speaker:'希尔维亚', text:'……爸爸。'},
    {text:'那个平时威严的大人，笑得像个孩子。', love:'sophia', loveD:1},
    {do:()=>love('claude',1)},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'可是第一个叫的是我！是贝蒂！'},
    {text:'月光把每个人的轮廓镀上柔光。\n温暖。这就是家人的感觉吗？\n前世好像也有过，但总隔着一层。现在不一样。\n明明才出生不到一年——但我已经开始喜欢这个家了。', freeRoam:true}
  ]
};

SCENES.s_alice_born = {
  bg:'bg-room', phase:'childhood',
  card:{vol:'第一卷', t:'第二章', s:'三姐妹'},
  lines:[
    {text:'两岁。母亲的肚子大了起来。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'我们要有弟弟或者妹妹了！！'},
    {text:'那天在房门外等了很久。婴儿的哭声传来。'},
    {ch:'claude', speaker:'克劳德', text:'是女孩。'},
    {ch:'sophia', speaker:'索菲亚', text:'这是你们的妹妹，爱丽丝。'},
    {ch:'alice', emo:'normal', text:'白色的胎发，像新落的雪。很小，很软。', know:'alice', knowD:30},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'皱巴巴的，红红的，眼睛闭着，还在哇哇大哭。'},
    {ch:'sophia', speaker:'索菲亚', text:'以后你就是姐姐了，要照顾她哦。'},
    {text:'照顾？\n嗯。好像也不是不可以。', unlock:['study','garden'], freeRoam:true}
  ]
};

SCENES.s_yaoshen = {
  bg:'bg-hall',
  lines:[
    {text:'四岁末。家族晚宴。巴依王国的贵宾。'},
    {text:'我坐在角落戳蔬菜。姐姐被其他贵族小孩叫走了。'},
    {ch:'yaoshen', speaker:'？？？', text:'小姐一个人坐在这里？'},
    {text:'中年男人。深褐色皮肤，浓密胡须，白色长袍，腰间挂满小瓶子。'},
    {speaker:'药神', text:'叫我药神就好。你父亲在那边忙，我就四处转转。'},
    {speaker:'希尔维亚', text:'您腰上挂的是什么？'},
    {speaker:'药神', text:'药。治病的、解毒的、强身的……比如这个，治头疼，喝一口就好。'},
    {text:'他认真回答我每一个幼稚的问题。不敷衍。\n和其他大人物不一样。', know:'yaoshen', knowD:15, ach:'potion_god'},
    {speaker:'药神', text:'冰可是赋亲和，很稀有。真厉害。这个送给你——别打开，有轻微刺激性。当装饰品。'},
    {item:{id:'blue_vial', name:'淡蓝小瓶', icon:'🧪', desc:'药神所赠。不要打开。'}, gold:0},
    {text:'瓶中淡蓝液体在灯光下泛着微光。像一小块天空。', freeRoam:true}
  ]
};

// childhood hub trigger for first word
SCENES.s_child_hub = {
  lines:[{text:'日子一天天过去。', freeRoam:true}]
};

// ===== 三姐妹的岁月 (5岁) =====
SCENES.s_sisters_grow = {
  bg:'bg-img-parlor bg-hall', phase:'childhood',
  card:{vol:'第一卷', t:'第三章', s:'三姐妹的岁月'},
  lines:[
    {text:'五岁。'},
    {text:'姐姐贝阿特丽丝七岁，正处于精力过剩的年纪。妹妹爱丽丝三岁，正处于像个小尾巴一样黏人的年纪。'},
    {text:'日子过得非常规律，规律到让我这种心理年龄早已成年的人感到一种养老般的舒适。'},
    {text:'但我那姐姐显然不这么想。除了基础课程，她现在的日程表里塞满了魔法训练和剑术启蒙。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'身为贵族女性，只有魔法是不够的！万一遇到魔力耗尽的情况，我就用这把剑保护妹妹们！'},
    {text:'她手里握着一把木剑，站在客厅中央发表宣言。挥剑带起的风声很吓人，转身横扫距离花瓶只有两厘米。'},
    {text:'我默默地向后平移了一步，把花瓶也往后拖了一点。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……姐姐，保护我们的前提是，别先把我们打晕。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'怎么可能！我的剑术可是为了你们练的！谁敢欺负我妹妹，我就——'},
    {text:'她激动的挥剑动作再次擦过花瓶边缘。我叹了口气，默默把花瓶又往后挪了挪。'},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……贝阿特丽丝姐姐真厉害。'},
    {text:'爱丽丝适时地送上了捧场，眼神清澈崇拜。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'嘿嘿，是吧！等你们长大了，姐姐罩着你们！'},
    {text:'这就是我的姐姐。元气满满，精力充沛，偶尔有点冒失。'},

    {bg:'bg-img-study bg-study', text:'而相比之下，三岁的爱丽丝简直是省心模范。'},
    {text:'面对老师的夸奖，爱丽丝的表现堪称教科书级别的"乖巧妹妹"。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……都是老师教得好。而且，比起姐姐们，我还差得远。'},
    {text:'这一记直球把老师的好感度刷满了，连我也觉得很受用。'},
    {text:'课后，这个"差得远"的小家伙蹭到了我身边。'},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……姐姐大人。有个历史问题不太懂，可以教我吗？'},
    {text:'我耐心地给她讲了一遍。她听得很认真，点头的频率恰到好处。'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……原来是这样。谢谢姐姐大人，姐姐大人真厉害。'},
    {text:'她笑了笑，心满意足地走了。每次问的问题都不会太难让我尴尬，也不会太简单感觉敷衍。'},
    {text:'算了，爱丽丝才三岁，会有什么心思呢。'},

    {bg:'bg-img-garden bg-garden', text:'五岁这一年，我的魔法有了长足的进步。新技能「水流操控」极其好用，简直是懒人福音——它能不用起身就帮我把桌子上的红茶送到嘴边。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'希尔维亚！江湖救急！'},
    {text:'姐姐惨烈的叫声从浴室传来。浴室仿佛刚经历了一场海啸，水管爆了，姐姐站在水帘洞中央，浑身湿透。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'快！用你的魔法把它停住！'},
    {text:'虽然我是公爵千金，不是水管工，但看来这活儿只能我干了。'},
    {text:'水流操控。漫天飞舞的水珠在我的引导下乖乖聚拢，缓缓流进浴缸。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'得救了！希尔维亚你太神了！'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……只是暂时的。叫人来修吧。'},
    {text:'姐姐因为太激动直接扑了过来。一个湿漉漉的拥抱。我的干爽衣服瞬间宣告阵亡。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……姐姐，你是在报复我吗？'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'哎呀，反正都要换衣服嘛！'},
    {text:'我面无表情地任由她抱着。算了，看在她笑得这么开心的份上。'},

    {bg:'bg-img-garden bg-garden', text:'晚上，爱丽丝来找我，听说了浴室的事。'},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……姐姐大人用魔法控制住了那么大的水流？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'勉强吧。'},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……姐姐大人好厉害。我也想学。等我测完亲和，姐姐大人可以教我吗？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'当然，如果你不嫌我教得不好的话。'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……只要是姐姐大人教的，就好。'},
    {text:'不知道为什么，这孩子每次说这种话的时候，都真诚得让我无法拒绝。'},

    {bg:'bg-img-garden bg-garden', text:'夏天到了，阿斯拉王国的夏天热得让人怀疑人生。不过我有着解暑神器：「冰霜之息」。'},
    {text:'午后，蝉鸣声吵得人心烦。我和爱丽丝躲在树荫下。'},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……好热。'},
    {text:'爱丽丝额头上渗出细密的汗珠，脸颊被热气蒸得粉扑扑的。'},
    {text:'我张口，轻轻吐出一缕寒气。周围空气瞬间降温，爱丽丝舒服地眯起了眼睛，靠在我肩膀上。'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……好凉快。姐姐大人是冰系真好。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'这算是对我天赋的最高赞扬吗？'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……嗯。如果是火系的话，夏天就不能靠得这么近了。姐姐大人，再来一口？'},
    {text:'看着她这副把我当成移动空调的样子，我忍不住笑了。那个下午，我们就这样靠在一起。很安静，很舒服。', freeRoam:true},
  ]
};

// ===== 遇见雷纳德叔叔 (6岁) =====
SCENES.s_reno_arrive = {
  bg:'bg-img-dining bg-hall', phase:'youth',
  card:{vol:'第一卷', t:'第四章', s:'浪人叔叔'},
  lines:[
    {text:'六岁。'},
    {text:'传说中那个"离家出走"的叔叔回来了。我小时候模模糊糊见过他两三面，听说他还和阿斯拉魔法大学的校长法神从前是同学。'},
    {text:'雷纳德·维斯特利亚，我父亲的弟弟。比起总是板着脸、威严满满的父亲，这位叔叔简直像是另一个物种。'},
    {ch:'reno', speaker:'雷纳德', text:'惊喜！我回来啦！'},
    {text:'他风尘仆仆地出现在餐厅门口，背着个巨大的包裹，靴子上全是泥巴，笑得像个没心没肺的大孩子。'},
    {text:'父亲扶额叹气，母亲笑着摇头，只有贝阿特丽丝姐姐冲上去给了他一拳——当然没打中。'},
    {text:'叔叔在家里住了半个月，我也终于明白了为什么法神大人会是他的同学——这人虽然看着不正经，但魔法造诣很高。'},
    {text:'当然，他主要的作用还是讲故事。'},
    {ch:'reno', speaker:'雷纳德', text:'驰弩帝国北边的森林里，有一种雪狼，大概有这么大——全身雪白，跑起来像一团滚动的雪球！'},
    {text:'贝阿特丽丝姐姐听得两眼放光，恨不得立刻提剑去北边。爱丽丝则安静地坐在我旁边，偶尔问几个问题。'},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……那里的风大吗？暴风雪会持续多久？'},
    {text:'问题虽然有点偏，但叔叔很高兴有人对细节感兴趣，讲得更起劲了。'},
    {bg:'bg-img-nursery bg-room', text:'某天晚上，叔叔溜进我房间，检查了我的魔法进度。'},
    {text:'看完我的冰晶术后，他收起了那副嬉皮笑脸的表情。'},
    {ch:'reno', speaker:'雷纳德', text:'六岁能控制到这个程度，咱们家这是出了个小怪物啊。等你以后去了魔法大学，要是有人欺负你，就报我名字。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'报了有用吗？'},
    {ch:'reno', speaker:'雷纳德', text:'大概有用吧……只要法神大人忘掉了我欠她钱的事。'},
    {text:'看来以后还是尽量别报他的名字比较好。', know:'reno', knowD:20, freeRoam:true},
  ]
};


// ===== 爱丽丝亲和测试 (7岁) =====
SCENES.s_alice_affinity = {
  bg:'bg-img-auditorium bg-hall', phase:'youth',
  card:{vol:'第一卷', t:'第五章', s:'风之亲和'},
  lines:[
    {text:'七岁。'},
    {text:'爱丽丝终于到了做亲和测试的年纪。'},
    {text:'全家人都在礼堂围观。爱丽丝把手放在水晶球上，表情严肃得像是在进行什么神圣的仪式。'},
    {text:'几秒后，青色的光芒亮起，如同流动的风，纯净而轻盈。'},
    {speaker:'魔法师', text:'风亲和！而且纯度极高！这是极为罕见的天赋啊！'},
    {text:'大家都在欢呼，父亲更是难得地露出笑容。'},
    {text:'只有当事人爱丽丝，看着那团青光，表情有一瞬间的……失落？'},
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……是风啊。和姐姐大人不一样呢。'},
    {text:'声音小得只有我听见了。原来是在纠结这个。'},
    {bg:'bg-img-garden bg-garden', text:'测试结束后，她在花园找到了我。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……姐姐大人。虽然亲和不一样……但我以后还可以和你一起练习吗？'},
    {text:'看着那双写满忐忑的眼睛，我伸手摸了摸她柔软的头发。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'傻瓜，魔法的基础原理是通用的。不管你是风还是火，只要你想练，我都在。'},
    {text:'她的眼睛瞬间亮了，嘴角弯起一个好看的弧度。'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……嗯！谢谢姐姐大人！'},
    {text:'她笑得那么开心，让我也跟着心情变好了。', love:'alice', loveD:2, know:'alice', knowD:5, freeRoam:true},
  ]
};

SCENES.s_beatrice_leaves = {
  bg:'bg-img-hallway bg-hall', phase:'youth',
  lines:[
    {text:'十岁。姐姐要去魔法大学了。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'希尔维亚！姐姐要出发了！等我到了大学，一定把所有好玩的事都写信告诉你！'},
    {ch:'sophia', speaker:'索菲亚', text:'贝阿特丽丝，路上小心。'},
    {ch:'claude', speaker:'克劳德', text:'到了学校好好学习。别光顾着玩。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'知道啦知道啦！我可是贝阿特丽丝大人！一定会成为全校最厉害的！'},
    {text:'姐姐在门口挥了挥手，跳上了马车。金色的头发在阳光下闪闪发亮。'},
    {text:'马车走远了。门口变得安静。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……姐姐大人。贝阿特丽丝姐姐走了。'},
    {text:'嗯。两年后我们也会去。'},
    {ch:'alice', speaker:'爱丽丝', text:'……嗯。'},
    {text:'公爵府安静了一些。少了那个大嗓门，走廊好像变长了。', freeRoam:true}
  ]
};

// ----- ACADEMY -----
SCENES.s_academy_start = {
  bg:'bg-img-uni bg-school', phase:'academy',
  card:{vol:'第二卷 魔法大学篇', t:'第一章', s:'离巢'},
  lines:[
    {text:'十二岁。终于到了入学的年纪。这两年过得很快。练习魔法，陪妹妹，偶尔和姐姐的信件往来。平静而充实。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……姐姐大人。我到中级了。……三年后我也会去大学的。……到时候，姐姐大人会来接我吗？'},
    {text:'「会。」她笑了，弧度很浅。「……那我等姐姐大人。」'},
    {text:'出发的日子。清晨。我站在窗边，最后看了一眼熟悉的房间。床铺、书桌、书架。十二年。这里是我在这个世界的第一个家。'},
    {ch:'claude', speaker:'克劳德', text:'希尔维亚。到了大学，好好学习。遇到困难可以找你姐姐，也可以找法神大人。你是维斯特利亚家的女儿。不必刻意张扬，但也不要妄自菲薄。'},
    {ch:'sophia', speaker:'索菲亚', text:'注意身体，按时吃饭。想家了就写信回来。'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……姐姐大人。路上小心。……到了要给我写信。……每个月都要写。……我会想姐姐大人的。'},
    {text:'我伸出手，摸了摸她的头。「两年后来找我。」她用力点头。'},
    {text:'马车缓缓驶离公爵府。妹妹站在门口，一直看着这边。越来越远，越来越小。最后变成一个白色的点，然后消失在视野里。', know:'alice', knowD:5},
    {do:()=>{ ['dorm','water_class','ice_class','library','cafeteria','training_field','clocktower','flowerhouse','memorial','auditorium','market'].forEach(id=>{if(LOCS[id])LOCS[id].unlock=true;}); S.loc='dorm'; S.lastSafe='dorm'; updateLocBar(); }},
    {text:'远处，高耸的尖塔，宏伟的城墙，在阳光下闪闪发光的魔法阵纹。阿斯拉魔法大学。'},
    {bg:'bg-room', loc:'dorm', text:'东区宿舍 312。门没锁。推开门——'},
    {ch:'emma', speaker:'艾玛·克莱尔', text:'新室友！！我是艾玛·克莱尔！你可以叫我艾玛！银色头发，蓝眼睛……你是维斯特利亚家的？！你姐姐也是——不对她是金色的来着？你和她不太像诶。她特别有活力，你看起来……嗯……比较安静？不过安静也挺好的！我话比较多，以后你多担待啊！', know:'emma', knowD:20, love:'emma', loveD:1},
    {text:'她帮我把行李搬进来，一边搬一边说话。说了一串名字，我一个都没记住。不是记不住，是懒得记。反正以后慢慢认识。'},
    {text:'晚饭时间，姐姐冲进来了。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'希尔维亚！！你终于来了！！我等了好久！！两年没见了诶！！长高了嘛！但还是没我高！走！带你去吃饭！学校食堂我都摸清楚了！', love:'beatrice', loveD:1},
    {text:'姐姐把我抱得喘不过气。艾玛在旁边看得目瞪口呆。食堂。姐姐一边吃一边说个不停——基础课、专业课、冰系老师……'},
    {do:()=>{ S.loc='dorm'; S.lastSafe='dorm'; S.phase='academy'; updateLocBar(); }, text:'（魔法大学：自由探索校园、上课、交友、修行。点「推进时间」可看后续剧情。）', freeRoam:true}
  ]
};

SCENES.s_noelle_meet = {
  bg:'bg-school', phase:'academy',
  card:{vol:'第二卷', t:'第二章', s:'同龄人'},
  lines:[
    {text:'开学第一天。我被艾玛的尖叫声吵醒。'},
    {ch:'emma', speaker:'艾玛', text:'啊啊啊啊要迟到了！！！'},
    {text:'太阳才刚露出个头顶，离上课至少还有一个小时。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……还早。'},
    {ch:'emma', speaker:'艾玛', text:'早什么早！第一天上课不能迟到！这是态度问题！'},
    {text:'深蓝色长袍，胸口绣着学院纹章，袖口和领口镶着银边。穿上之后确实有种「我现在是个正经学生了」的错觉。'},
    {bg:'bg-img-auditorium bg-hall', text:'新生集会在大礼堂举行。几百个十二岁左右的少年少女坐在下面。台上的中年教师开始念学校规章——食堂开放时间，图书馆借书规则，训练场使用须知……'},
    {text:'我一边听一边在心里吐槽：这些东西不能印成小册子发下来吗？非要在这里念半个小时催眠曲？'},
    {speaker:'老师', text:'——以上。现在请各位按亲和属性前往对应学院报到。水系往左，火系往右……'},
    {bg:'bg-school', text:'水系学院的教室里已经坐了二十多人。我找了个靠窗的位置坐下。'},
    {ch:'noelle', speaker:'诺艾儿', text:'这里有人吗？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'没人。'},
    {text:'「那我坐了。」她拉开椅子坐下，从书包里掏出一本厚得能砸死人的书，低头就看了起来。完全没有自我介绍的意思。……这人还挺酷的。', know:'noelle', knowD:15},
    {ch:'anna', speaker:'安娜·贝尔', text:'欢迎来到水系学院。接下来做个小测试，了解一下大家的水平。让杯子里的水悬浮起来，能浮多高、多稳，就代表你们的控制力。'},
    {text:'轮到她——水从杯子里升起，稳稳地悬浮在三十厘米的高度。'},
    {ch:'anna', speaker:'安娜·贝尔', text:'不错。你叫什么名字？'},
    {ch:'noelle', speaker:'诺艾儿', text:'诺艾儿。'},
    {text:'导师看了看名单，表情有些微妙。「……平民？」教室里响起窃窃私语。'},
    {ch:'noelle', speaker:'诺艾儿', text:'是。'},
    {text:'诺艾儿面无表情地走回座位，像是那些议论跟她毫无关系，继续低头看书。这心理素质……我有点佩服她。'},
    {text:'「下一个，希尔维亚·维斯特利亚。」我站起来，走上前。水升起来，悬浮，然后我让它旋转，分成几股细流，最后汇聚成一颗圆滚滚的水球。表面光滑得像镜子。'},
    {text:'教室里安静了。导师看起来有点惊讶。'},
    {ch:'anna', speaker:'安娜·贝尔', text:'……这是中级水准了。你入学前接受过训练？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'家里教过一些。'},
    {text:'走回座位的时候，感觉到无数道目光。有羡慕的，有好奇的，也有一些不太友善的。大概是在想「贵族果然资源多」之类的吧。这种事情，习惯就好。'},
    {ch:'noelle', speaker:'诺艾儿', text:'喂。……你是公爵家的。刚才那个水球，控制得挺稳。但太规整了。像是在照着教科书做题。每一步都很精确，但没有变化。实战的时候会吃亏。'},
    {text:'我愣了一下。叔叔以前也说过类似的话。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……你打过实战？'},
    {ch:'noelle', speaker:'诺艾儿', text:'算是。我没有姓氏，也没有背景。不需要同情，也不需要照顾。'},
    {text:'说完她就往门外走。我看着她的背影，想了想。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'我也没打算同情你。'},
    {text:'她停下脚步，回过头，表情有些意外。然后她转身离开了。'},
    {bg:'bg-img-cafeteria bg-hall', text:'中午，艾玛拖着我去食堂。'},
    {ch:'emma', speaker:'艾玛', text:'快快快！去晚了好吃的就没了！'},
    {text:'她盯着一小碟焦糖布丁，像一只发现猎物的猎犬。'},
    {ch:'emma', speaker:'艾玛', text:'希尔维亚你知道吗！你在水系测试的事情已经传开了！大家都在说「公爵家的天才」什么的！当然啦——不过也有人说酸话……'},
    {ch:'sylvia', speaker:'希尔维亚', text:'随他们说吧。'},
    {ch:'emma', speaker:'艾玛', text:'你心态真好。要是我，早气死了。'},
    {text:'正说着，诺艾儿端着餐盘走过来。'},
    {ch:'noelle', speaker:'诺艾儿', text:'这里有人吗？'},
    {ch:'emma', speaker:'艾玛', text:'没有没有！快坐快坐！我是艾玛！她室友！'},
    {ch:'noelle', speaker:'诺艾儿', text:'诺艾儿。'},
    {ch:'emma', speaker:'艾玛', text:'诺艾儿……你是平民对吧？好厉害啊！平民考进来超难的吧？'},
    {text:'诺艾儿的筷子顿了一下。'},
    {ch:'noelle', speaker:'诺艾儿', text:'……你不觉得平民不该来这里？'},
    {ch:'emma', speaker:'艾玛', text:'为什么？考进来就是有本事啊。'},
    {text:'诺艾儿看着她，表情有些复杂。'},
    {ch:'noelle', speaker:'诺艾儿', text:'……你和其他贵族不太一样。'},
    {ch:'emma', speaker:'艾玛', text:'我家就是个小男爵啦，哪算什么贵族。而且希尔维亚是公爵家的，她也没什么架子对吧？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'能力比身份重要。'},
    {text:'诺艾儿盯着我看了好几秒。'},
    {ch:'noelle', speaker:'诺艾儿', text:'……你是认真的？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'嗯。'},
    {text:'她低下头，继续吃饭。过了一会儿，轻声说：「……谢谢。」声音小得几乎听不见，像是不习惯说这种话。'},
    {text:'下午，基础魔法理论课。所有新生一起上。教室门突然被推开了——一个金发女生走进来，穿着华丽的礼服，身后跟着两个侍女，走路带风，像是来巡视领地的女王。'},
    {text:'教室里响起压抑的议论声。「贝尔蒙家的吧……」「王后母族诶！」「迟到了还这么大摇大摆的……」老师看了她一眼，皱了皱眉，但没说什么。大概是惹不起吧。'},
    {text:'她似乎察觉到了我的视线，回过头。蓝色的眼眸扫过教室，最后锁定在我身上。四目相对。她的眼神里带着一股子傲气，还有一点……打量？我面无表情地看回去。她盯了我两秒，转回去继续听课。'},
    {ch:'noelle', speaker:'诺艾儿', text:'她一直在看你。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'嗯。'},
    {ch:'noelle', speaker:'诺艾儿', text:'你认识她？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'不认识。'},
    {ch:'noelle', speaker:'诺艾儿', text:'贝尔蒙家和维斯特利亚家不是对头吗？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'大人的事，跟我没关系。'},
    {text:'放学的时候，姐姐在路上堵住了我。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'希尔维亚！！第一天怎么样？交到朋友了吗？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……还行。交到两个。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'谁谁谁？快说！'},
    {text:'我把艾玛和诺艾儿的事简单说了一遍。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'艾玛我知道，你室友嘛。诺艾儿……平民？考进来的平民都是狠人啊。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……遇到了贝尔蒙家的。'},
    {text:'姐姐的表情变了。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'夏洛特？那个傲慢狂？她昨天在走廊上撞到我，连句道歉都没有！我当然怼回去了！我说「那维斯特利亚家从不给傲慢的人让路」！'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……你这是赢了吗？'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'当然赢了！有事就找我！虽然我可能打不过她，但吵架绝对吵得过！'},
    {text:'有个这样的姐姐，虽然吵，但也挺好的。', love:'noelle', loveD:1, know:'charlotte', knowD:5, freeRoam:true}
  ]
};

SCENES.s_charlotte_meet = {
  bg:'bg-hall', phase:'academy',
  card:{vol:'第二卷', t:'第二章', s:'夏洛特'},
  lines:[
    {text:'回宿舍的路上。夏洛特·贝尔蒙带着两个侍女，穿着那件层层叠叠的华丽礼服，挡在路中央，像是一尊金灿灿的障碍物。'},
    {ch:'charlotte', speaker:'夏洛特', text:'听说你在霍尔那老头的课上表现不错？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'还行吧。'},
    {ch:'charlotte', speaker:'夏洛特', text:'和你姐姐完全不是一个路子。贝阿特丽丝一见面就像个点着的爆竹，你倒是冷得让人想打喷嚏。那是赞美吗？你可以这么理解。'},
    {text:'她走近几步，压低声音。'},
    {ch:'charlotte', speaker:'夏洛特', text:'咱们两家在朝廷上的恩怨你肯定知道。所以，期中考试比一比？成绩。你要是输了，就承认维斯特利亚家这一代不如贝尔蒙家。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'那我要是赢了呢？'},
    {text:'夏洛特愣了一下，似乎没想过这个可能性，随后有些僵硬地扬起下巴。'},
    {ch:'charlotte', speaker:'夏洛特', text:'那我就承认你这个人还行。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……这赌注完全不对等吧？'},
    {ch:'charlotte', speaker:'夏洛特', text:'嫌弃就算了，反正是你没胆量。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'行吧，反正我也没指望能从你那赢到什么。'},
    {text:'夏洛特被我气得噎了一下，拎起裙角冷哼。'},
    {ch:'charlotte', speaker:'夏洛特', text:'你给我等着！'},
    {text:'这种拙劣的激将法，偏偏对我这种懒人挺管用——因为不答应的话，她大概会一直缠着我。', know:'charlotte', knowD:11, love:'charlotte', loveD:1, freeRoam:true}
  ]
};

SCENES.s_huke = {
  bg:'bg-img-town bg-town', phase:'academy',
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
  bg:'bg-night', phase:'finale',
  card:{vol:'第一卷', t:'转折点（一）', s:'——'},
  lines:[
    {do:()=>{ S.ageY=Math.max(S.ageY,15); syncStatsToAge(); }},
    {text:'十五岁的冬天。寒假。公爵府。\n雷纳德叔叔背着大包风尘仆仆出现在餐厅门口，靴子上全是泥，笑得像没心没肺的大孩子。'},
    {ch:'reno', speaker:'雷纳德', text:'惊喜！我回来啦！'},
    {text:'父亲扶额，母亲笑着摇头，贝蒂冲上去给了他一拳（没打中）。'},
    {text:'六个人坐在一张桌子上。姐姐的论文改完了——「十八遍！贝阿特丽丝大人的旷世巨著！」\n一切都很好。'},
    {text:'我躺在床上。枕头很软。'},
    {sfx:'bad', text:'碎裂声。不是玻璃——是石头。从大门方向。'},
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
    {bg:'bg-img-forest bg-forest', text:'我在跑。密道很长。出口是冬夜的林地。'},
    {text:'回头。公爵府方向的天空有一片不正常的橘色。\n是火光。', task:'survive_night', ach:'black_hair'},
    {text:'往东。不拐弯。不停。先活下来。'},
    {do:()=>{ S.alias='眷寒渔'; S.phase='journey'; ['road','jikan','northforest'].forEach(id=>{if(LOCS[id])LOCS[id].unlock=true;}); S.loc='road'; }},
    {text:'（第三卷 旅途篇。以「眷寒渔」之名前行。可前往澄岚镇霁馆。）', freeRoam:true}
  ]
};

SCENES.s_jikan_arrive = {
  bg:'bg-room', phase:'journey',
  lines:[
    {text:'澄岚镇。冒险者公会门口。'},
    {ch:'jilan', speaker:'霁岚', text:'你好！！你是来找活儿的对吧！！我们家剑馆——先来看看嘛看看又不要钱！！', know:'jilan', knowD:10},
    {text:'被一个紫蝴蝶发饰的女孩拉进了院子。'},
    {ch:'ji', speaker:'霁馆主', text:'哟。客人？吃了没？坐！马上好！', know:'ji', knowD:10},
    {text:'铁锅里的东西颜色介于深褐与黑之间。菜叶在求救。'},
    {speaker:'希尔维亚', text:'……能吃。'},
    {speaker:'霁馆主', text:'能吃！！听到没有霁岚！'},
    {text:'空房间很多。名牌钉孔还在。窗台上枯着一盆植物。'},
    {text:'（可在霁馆休息、学剑，去北林讨伐赚取报酬。）', unlock:['jikan','northforest'], loc:'jikan', ach:'sword_begin', freeRoam:true}
  ]
};


// ----- more childhood / youth -----
SCENES.s_mana_awaken = {
  bg:'bg-room', phase:'childhood',
  lines:[
    {text:'三岁半。我开始尝试使用魔力。\n书上说：感知魔力是第一步。闭上眼睛，放空思绪，感受身体内部的流动。'},
    {text:'对我来说这并不难。前世我就很擅长发呆——发呆是我最喜欢的事。'},
    {text:'第一次尝试的那天晚上，我坐在床上，闭上眼睛。呼吸放缓。思绪渐渐空白。'},
    {text:'然后，我感觉到了。\n身体里有什么东西在流动。不是血液——更深层，更细微，像无数条细小的溪流在四肢百骸间穿行。'},
    {text:'这就是魔力？\n我试着把那股流动引导到手掌。很慢，很困难。像不借助手去控制一条绳子。但确实在动。'},
    {text:'睁开眼。指尖泛着淡淡的蓝光。\n一闪即逝。但我确实看到了。', sfx:'magic', flag:'mana_awakened', task:'mana_sense', ach:'lazy_genius'},
    {do:()=>{ addExp(100); checkTierUp(); }},
    {text:'系统发出提示音。任务「魔力初感」完成。经验值上涨。等级提升。'},
    {text:'属性涨了一点点。成长很慢，但总归在成长。\n婴儿嘛——不对，我已经三岁半了。'},
    {text:'（「勇者之赐」即将触发——七个选项，未选者永久消失。）'},
    {pickTier:0},
  ]
};

SCENES.s_tier1_story = {
  bg:'bg-pick',
  lines:[
    {text:'世界静止了。窗帘凝固，虫鸣消失。'},
    {text:'「勇者之赐」——最高阶段首次提升。'},
    {text:'七个选项。未选者永久消失。'},
    {pickTier:1},
  ]
};

SCENES.s_alice_talk = {
  bg:'bg-study',
  lines:[
    {ch:'alice', emo:'normal', speaker:'爱丽丝', text:'……姐姐大人。念。'},
    {text:'她把绘本放在我面前。《森林里的朋友》。'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……请。'},
    {text:'一岁半的孩子，会用敬语？'},
    {text:'念完一本，她说：'},
    {ch:'alice', emo:'shy', speaker:'爱丽丝', text:'……姐姐大人。'},
    {text:'从那以后，她就一直这么叫我。', love:'alice', loveD:1, know:'alice', knowD:10, freeRoam:true}
  ]
};

SCENES.s_micro = {
  bg:'bg-img-town bg-town', loc:'town', phase:'youth',
  card:{vol:'第一卷', t:'第4.1章', s:'微服出行'},
  lines:[
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'我们去城里逛逛吧！三姐妹！微服出行！'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……姐姐大人，我也想去。'},
    {text:'护卫从二十人压到四个。所谓朴素衣服上仍有银线刺绣。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'完美！根本看不出我们是公爵家的！'},
    {ch:'alice', speaker:'爱丽丝', text:'……贝阿特丽丝姐姐，马车上有家徽。'},
    {text:'点心店：姐姐拍下一枚金币。「不用找了！」老板差点跪下。'},
    {text:'首饰店：二十金币的「深海蓝宝石」——其实是青金石。一人一条。'},
    {text:'广场上小女孩丢了猫。姐姐抓了一把金币加赏。'},
    {text:'半个时辰后，广场上堆了二十多只橘猫。还有一只狗。'},
    {ch:'alice', speaker:'爱丽丝', text:'……这只是狗。'},
    {speaker:'路人', text:'它是橘色的！四舍五入就是橘猫！'},
    {text:'父亲晚饭时表情很奇怪。护卫队长在耳边报账。'},
    {ch:'claude', speaker:'克劳德', text:'……今天出去玩了？'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'非常低调！根本没人认出我们！'},
    {text:'我夹了一块红烧肉。今天的红烧肉真好吃。', ach:'micro_service', gold:-50, love:'beatrice', loveD:1, love_alice:1},
    {do:()=>{ love('alice',1); flag('ch_micro',1); }},
    {text:'（微服出行的传说将在领地流传很久。）', freeRoam:true}
  ]
};

SCENES.s_beach = {
  bg:'bg-img-beach bg-beach', loc:'beach', phase:'academy',
  card:{vol:'第一卷', t:'第七章', s:'海与贝壳'},
  lines:[
    {text:'暑假。姐姐在马车上睡着了，嘴角还挂着果酱渍。'},
    {text:'到了。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'大海！！'},
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
    {ch:'sophia', speaker:'索菲亚', text:'你父亲出发前偷偷把公文塞进了行李箱夹层。我发现了，锁进了书房的柜子里。柜子上了魔力锁，只要你父亲的手碰到锁面，就会触发警报。会响遍整栋别墅的那种哦。'},
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
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'怎么样！贝阿特丽丝大人的泳装秀！打分！满分十分！'},
    {speaker:'希尔维亚', text:'六分。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'为什么只有六分！！'},
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
    {ch:'alice', speaker:'爱丽丝', text:'……姐姐，可能有心上人了。每天固定时间消失，不想让人知道。回来时头发乱、呼吸快、脸上带红晕、还会照镜子傻笑。……这些特征加在一起，最符合的假设就是——在和某个人约会。'},
    {text:'姐姐？恋爱？贝阿特丽丝·维斯特利亚？那个追寄居蟹追三圈的贝阿特丽丝？'},
    {ch:'alice', speaker:'爱丽丝', text:'……明天下午，我们跟去看看。'},
    {text:'◇'},
    {text:'第五天，下午。我们跟踪姐姐穿过小镇东区，绕过码头边一排废弃仓库，来到了一片偏僻的海滩。'},
    {text:'姐姐站在礁石旁边。和她站在一起的不是什么"心上人"——是一个老奶奶。'},
    {text:'渔民。少说六十往上。'},
    {text:'姐姐脱掉了外面的罩衫——里面穿着泳衣——跟着老奶奶走进了水里。'},
    {text:'扑腾了两下。呛了。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'咳咳咳——好咸！！'},
    {text:'所以。姐姐不会游泳。'},
    {text:'贝阿特丽丝·维斯特利亚，十五岁，火系中级魔法师，自封"妹妹保镖"。找了个渔村老奶奶当教练，偷偷学游泳。'},
    {text:'身上的红印是礁石磕的。头发乱是泡了海水。呼吸快是体力消耗。而照镜子傻笑——大概是觉得自己又进步了一点。'},
    {text:'不是约会。不是心上人。是这个笨蛋在学游泳。'},
    {text:'姐姐发现了我们。她的表情以肉眼可见的速度经历了震惊→恐慌→窘迫→崩溃四个阶段。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'哼！看到就看到了！我只是觉得游泳是贵族基本功！——就是为了能自己潜到深水区嘛！那边的礁石缝里有月虹螺！！我想亲手捞上来给爱丽丝做入学礼物！！买的谁不会买啊我就是想亲手——'},
    {text:'话说到一半。她愣住了。嘴还张着，但声音没了。'},
    {text:'月虹螺。深水区。亲手捞。给妹妹。做入学礼物。她全说了。'},
    {ch:'beatrice', emo:'sad', speaker:'贝阿特丽丝', text:'……本来想在你入学那天给你惊喜的。……结果我连游泳都不会。练了快一个星期，连深水区的边都摸不到。……我是不是很笨？连给妹妹准备个入学礼物都做不好……明明是姐姐……什么都做不好。'},
    {text:'她眼眶红红的。嘴唇在发抖。'},
    {text:'我走进水里。海水凉凉的，没过膝盖。'},
    {speaker:'希尔维亚', text:'你确实挺笨的。追寄居蟹追三圈那种笨。堆沙堡把自己金库踩塌了那种笨。微服私行花了不知道多少金币那种笨。'},
    {ch:'beatrice', emo:'sad', speaker:'贝阿特丽丝', text:'你还提那个！！'},
    {speaker:'希尔维亚', text:'但是——'},
    {text:'我伸手，把她肩上那条海藻拿掉了。'},
    {speaker:'希尔维亚', text:'——这种笨蛋姐姐，就是全天下最让人喜欢的姐姐。'},
    {text:'妹妹不知道什么时候也走进了水里。她走到姐姐面前，仰起头。'},
    {ch:'alice', emo:'smile', speaker:'爱丽丝', text:'……贝阿特丽丝姐姐。谢谢。……不管最后做不做得出来，谢谢你想为我做这些。……但是比起礼物——我更想和姐姐们一起待着。一起捞贝壳也好。一起呛水也好。一起被老奶奶骂也好。……只要是一起的，就是最好的礼物。'},
    {text:'姐姐盯着她看了三秒。然后嘴巴一瘪，眼泪终于掉下来了。'},
    {ch:'beatrice', emo:'sad', speaker:'贝阿特丽丝', text:'你们两个——你们两个——'},
    {text:'她一把把我和妹妹搂进怀里。湿淋淋的、咸兮兮的、黏糊糊的拥抱。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'好！既然都知道了！那就一起捞！三个人总比一个人快！'},
    {speaker:'希尔维亚', text:'我可以用冰魔法在水下开路。'},
    {ch:'alice', speaker:'爱丽丝', text:'……我可以用风魔法辅助呼吸。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'你们两个作弊了吧？？'},
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
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'谁哭了！！是风！！'},
    {ch:'alice', speaker:'爱丽丝', text:'……屋里没风。'},
    {text:'十三岁的暑假。大海、贝壳、笨得可爱的姐姐、和太过聪明的妹妹。真好。', ach:'shell_gift', love:'beatrice', loveD:1},
    {do:()=>love('alice',1)},
    {item:{id:'shell_pin', name:'月虹螺胸针', icon:'🐚', desc:'三姐妹一起捞的。'}, freeRoam:true}
  ]
};

SCENES.s_star_festival = {
  bg:'bg-night', phase:'academy',
  card:{vol:'第二卷', t:'第九章', s:'并肩的树 · 星辰祭'},
  lines:[
    {text:'星辰祭。六年一次。家长开放日。'},
    {text:'广场上——深蓝色粗布外套，扣到最上一颗。霜杉木簪。'},
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'是爸妈吧？！'},
    {text:'姐姐一头撞进父亲怀里。母亲理了理爱丽丝额前的碎发。'},
    {ch:'alice', emo:'shy', text:'她的睫毛颤了一下。手在裙子侧面攥紧又松开。'},
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

SCENES.s_tree = {
  bg:'bg-garden', phase:'academy',
  lines:[
    {ch:'beatrice', emo:'happy', speaker:'贝阿特丽丝', text:'贝阿特丽丝大人要种树！要比六年级所有人都先种！'},
    {text:'她为了种子帮管理员搬了三天花肥。'},
    {ch:'alice', speaker:'爱丽丝', text:'火系要像手炉一样把热量渗进土里。姐姐大人控温，我控风。'},
    {text:'十一天后，嫩芽顶出土屑。'},
    {text:'石牌上三个名字。竖排。', task:'plant_tree', love:'beatrice', loveD:1},
    {do:()=>love('alice',1)},
    {text:'旁边那棵旧树的木牌：——mond。', freeRoam:true}
  ]
};

SCENES.s_helena = {
  bg:'bg-img-auditorium bg-hall', loc:'auditorium', phase:'academy',
  card:{vol:'第二卷', t:'第三章', s:'访客'},
  lines:[
    {text:'期中考试后的第二周，学校里来了一批交换生。'},
    {ch:'emma', speaker:'艾玛', text:'听说是希里昂神圣国来的！神圣国诶！那个传说中治愈魔法最厉害的国家！'},
    {ch:'noelle', speaker:'诺艾儿', text:'治愈魔法啊……那确实是他们的强项。'},
    {text:'欢迎仪式在大礼堂举行。交换生一共五个人，三男两女，穿着白色长袍，胸口绣着金色太阳纹章。法神大人亲自出席。'},
    {text:'三个男生站得笔直，像三根白色的旗杆。两个女生站在最边上——一个黑发，一个金发。金发的那个在微笑。不是官方的、礼貌的微笑，而是真的在笑，眼睛弯成月牙，整个人像是自带了一盏灯。'},
    {text:'她注意到了我。大概是因为银色头发比较显眼吧。她对我眨了眨眼。然后又转回去，继续听校长讲话，像什么都没发生过。'},
    {ch:'emma', speaker:'艾玛', text:'……那个金发的女生好可爱啊……'},
    {bg:'bg-school', text:'欢迎仪式结束后，金发的女生被分到了水系。'},
    {ch:'helena', speaker:'海伦娜', text:'大家好！我叫海伦娜·德尔菲，来自希里昂神圣国，是神官见习生！接下来一个月请多多关照！', know:'helena', knowD:25},
    {text:'她环顾教室。目光扫过好几个空位，最后准确无误地落在了我旁边的那个。'},
    {ch:'helena', speaker:'海伦娜', text:'这里可以吗？你好呀！我叫海伦娜，你呢？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'希尔维亚·维斯特利亚。'},
    {ch:'helena', speaker:'海伦娜', text:'希尔维亚……好好听的名字！是银色的意思对吧？和你的头发好配！你的眼睛也好漂亮，是蓝色的呢！在我们国家，蓝色代表纯净和智慧！你的皮肤也好白——'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……上课了。'},
    {ch:'helena', speaker:'海伦娜', text:'哦对哦！那下课再说！'},
    {text:'下课后，下课铃响完第三秒她就转过来了。'},
    {ch:'helena', speaker:'海伦娜', text:'希尔维亚！给我看看冰魔法嘛！'},
    {bg:'bg-img-garden bg-garden', text:'花园里，我凝聚了一颗冰晶。'},
    {ch:'helena', speaker:'海伦娜', text:'哇！好漂亮！像钻石一样！'},
    {text:'她伸出手指戳了戳。「好凉！」「……那是冰。」「我知道啦！但是亲眼看到还是很神奇！我们国家冰系魔法师很少。」'},
    {text:'她掌心泛起淡淡的柔光。'},
    {ch:'helena', speaker:'海伦娜', text:'我是治愈系的。虽然还只是见习生，但简单的伤口已经可以治好了！以后你受伤了可以来找我！我免费给你治！'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……希望用不上。'},
    {text:'「你可以做别的形状吗？比如……花？」我挥了挥手，冰晶变形——六片花瓣从中心舒展开来。'},
    {ch:'helena', speaker:'海伦娜', text:'好厉害！好漂亮！那个那个，可以送给我吗？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……会融化的。'},
    {ch:'helena', speaker:'海伦娜', text:'没关系！我想要！'},
    {text:'她双手合十，眼巴巴地看着我。大型犬的既视感。「……拿去吧。」'},
    {text:'她小心翼翼地接过冰花，捧在手心里，像是捧着一件稀世珍宝。十指微微蜷起，留出一个小小的空间。'},
    {ch:'helena', speaker:'海伦娜', text:'谢谢希尔维亚！我会一直看着它的！直到它融化为止！'},
    {text:'她真的看了十分钟。这个人……没有距离感。明明才认识不到一个小时，但她的态度像是已经认识很久了。不是让人不舒服的那种热情，而是……很自然。'},
    {text:'接下来几天，海伦娜几乎每天都来找我。频率之高，稳定性之强，堪称人形闹钟。上课坐在我旁边。下课拉我去吃饭。晚上有时还会来宿舍串门。'},
    {ch:'emma', speaker:'艾玛', text:'你们认识才几天啊……怎么感觉比我和你还熟？她好像很喜欢你诶。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……可能只是对冰魔法感兴趣吧。'},
    {text:'有一次她在治愈术练习课上踩到了自己的长袍下摆，后脑勺磕在了石板地上。「我没事没事！嘶……一点都不疼！」眼角还挂着泪珠。'},
    {text:'我把手掌按在她后脑勺磕到的位置上。她的治愈魔法从我掌心下方泛起柔光，暖暖的。几秒后，肿包消下去了。'},
    {ch:'helena', speaker:'海伦娜', text:'好了！谢谢希尔维亚！你的手好凉！以后我摔倒了你就帮我按着好不好？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……你打算经常摔？'},
    {ch:'helena', speaker:'海伦娜', text:'不是啦！万一嘛！'},
    {text:'图书馆。诺艾儿坐在对面看书。海伦娜小跑过来，在我旁边坐下。'},
    {ch:'helena', speaker:'海伦娜', text:'找到你们了！'},
    {text:'她压低声音问「你们在看什么」，但她那种压低声音的方式，大概只比正常音量低了十分之一。'},
    {ch:'noelle', speaker:'诺艾儿', text:'高级咒语解析。'},
    {ch:'helena', speaker:'海伦娜', text:'好厉害……我看不懂……我们主要是神学和治愈术……阿斯拉的魔法教育真的很系统诶。'},
    {text:'她托着下巴。「我们主要是神殿教育。从小就在神殿里学习，学经文，学仪式，学治愈术……被选中的人，从三四岁开始就要离开家人住在神殿里。一年能见一两次就不错了。」'},
    {text:'她说得很平静，像是在说别人的事情。但我注意到，她的手指无意识地绞在一起。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……你想家吗？'},
    {text:'她愣了一下，然后又笑了。「有时候会想呢。但是神殿里的姐姐们都很好。而且——能来这里交流，认识希尔维亚你们，我觉得很开心。」'},
    {ch:'helena', speaker:'海伦娜', text:'希尔维亚虽然话不多，但人很好！诺艾儿虽然看起来冷冷的，但其实很认真！艾玛虽然有点吵，但很热情！'},
    {ch:'noelle', speaker:'诺艾儿', text:'你观察得很仔细。'},
    {ch:'helena', speaker:'海伦娜', text:'因为我很喜欢你们嘛！喜欢的人当然要好好了解！'},
    {text:'这话说得毫无犹豫，像呼吸一样自然。'},
    {text:'傍晚，海伦娜拉着我去看日落。'},
    {ch:'helena', speaker:'海伦娜', text:'这里的日落和神圣国的不一样诶！神圣国的日落是金色的，这里的是橙红色的！'},
    {text:'橙红色的光照在她脸上，把她的轮廓镀上了一层暖色。风吹过来，她的金发飘动了一下。'},
    {ch:'helena', speaker:'海伦娜', text:'希尔维亚。你相信神明吗？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……不知道。没想过这个问题。如果有神，那就有。如果没有，那就没有。对我的生活没什么影响。'},
    {ch:'helena', speaker:'海伦娜', text:'希尔维亚好洒脱。我有时候想太多，会很累。但是来这里之后，看到大家都活得很自在……我有点羡慕。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……你也可以活得自在一点。'},
    {ch:'helena', speaker:'海伦娜', text:'可以吗？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'为什么不可以？'},
    {text:'她看着我，眼神有些复杂。然后笑了。「希尔维亚说的话，总是让人觉得很简单呢。」「本来就很简单。」'},
    {text:'最后一天晚上，海伦娜来宿舍找我。「希尔维亚，陪我走走吧。」不是平时那种元气满满的语气。安静了很多。'},
    {text:'我们沿着校园的小路走，月光把影子拉得很长。路过花园的时候，她停下来。'},
    {ch:'helena', speaker:'海伦娜', text:'这里。你给我冰花的地方。那朵冰花我看了十分钟。一直到它化成一小滩水。'},
    {text:'她从袖子里掏出一个小东西。是一枚小小的十字架，银色的，做工精致，中央嵌着一粒极小的蓝宝石。'},
    {ch:'helena', speaker:'海伦娜', text:'这个送给你。神殿的信物。每个见习生只有一枚。是我入殿的时候圣女大人亲手给的。所以才要给你呀。不重要的东西送出去有什么意思？如果以后你来神圣国，有这个我就知道是你来找我。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……我不一定会去。'},
    {ch:'helena', speaker:'海伦娜', text:'没关系！就算你不来，你看到它的时候，也可以想起我嘛！'},
    {text:'她合上我的手指，让十字架被包在掌心里。她的手覆在我的手上，温热而柔软。'},
    {ch:'helena', speaker:'海伦娜', text:'希尔维亚，我很高兴认识你。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……我也是。'},
    {ch:'helena', speaker:'海伦娜', text:'真的？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'嗯。'},
    {text:'她的笑容更灿烂了。月光下的笑容，和白天的不太一样。更柔和一些。'},
    {ch:'helena', speaker:'海伦娜', text:'那我们就是朋友了！以后要给我写信哦！一言为定！不许反悔！'},
    {ch:'sylvia', speaker:'希尔维亚', text:'不反悔。'},
    {text:'第二天，马车远去。她从窗户探出头，挥手幅度大得像在指挥交通。「再见啦希尔维亚——！给我写信——！」'},
    {text:'我跟着她们走，手伸进口袋，摸到了那枚十字架。金属的触感凉凉的，但很快就被体温捂热了。和她的手一样的温度。', item:{id:'cross', name:'银十字架', icon:'✝️', desc:'海伦娜所赠。神殿信物。唯一的那枚。'}, love:'helena', loveD:2, flag:'ch_helena', know:'helena', knowD:38, do:()=>{ flag('helena_left_year', S.year); flag('helena_left_season', S.season); }, freeRoam:true}
  ]
};

SCENES.s_ajun = {
  bg:'bg-img-uni bg-school', phase:'academy',
  card:{vol:'第二卷', t:'第四章', s:'异国之味'},
  lines:[
    {text:'训练结束，我慢慢往回走，边走边活动肩膀。拐过一个弯，就看见一个人蹲在路边——棕色皮肤、金发、穿着花里胡哨衣服的男生，正把一张地图翻过来转过去。'},
    {text:'「这个地图到底怎么看啊……北边是哪边……这个箭头为什么朝下……」他甚至把地图倒过来看了。'},
    {ch:'ajun', speaker:'阿琼', text:'太好了！有人了！请问男生宿舍在哪边？我在这个路口转了四圈了！阿琼·普拉塔！从巴依王国来的！你好你好！', know:'ajun', knowD:18},
    {text:'他跳起来，热情地伸出手，摇的幅度大概够给风车发电。'},
    {ch:'ajun', speaker:'阿琼', text:'银发蓝眼！你是维斯特利亚家的对吧！我家里人告诉我的！说维斯特利亚家是阿斯拉的大贵族，和我们巴依关系一直很好！太好了！刚来就遇到朋友！'},
    {ch:'sylvia', speaker:'希尔维亚', text:'我们才刚认识……'},
    {ch:'ajun', speaker:'阿琼', text:'认识了就是朋友嘛！'},
    {text:'他一边走一边环顾四周，对什么都好奇。「哇，这个钟塔好高！」「那个花坛里种的是什么？好漂亮！」「月光草？晚上会发光？真的假的！！」'},
    {text:'话题还会自动切换——从仙人掌讲到巴依的花卉，从花卉讲到香料，从香料讲到他奶奶做的咖喱。'},
    {ch:'ajun', speaker:'阿琼', text:'我奶奶的咖喱是整条街最好吃的！她有一个祖传的香料配方！我偷看过一次，被她用勺子敲了头！不过她后来还是偷偷教我了，嘿嘿。你会做咖喱？'},
    {text:'他掌心的沙子旋转起来，变成了一朵花的形状。沙粒在空中折射着夕阳的光，每一颗都像微小的金片。'},
    {ch:'ajun', speaker:'阿琼', text:'沙之花，巴依小孩都会的入门魔法！送你了！不过没有魔力维持的话大概一分钟就散了。'},
    {text:'四十秒左右，花瓣开始松散。'},
    {ch:'ajun', speaker:'阿琼', text:'手艺还不太行，维持不了太久。我表叔做的沙花能撑半天呢！'},
    {bg:'bg-img-cafeteria bg-hall', text:'周日。公共厨房。空气里飘着从没闻过的香味——浓郁、温暖、带着某种说不出的层次感。如果颜色有味道的话，这个味道大概是深金色的。'},
    {ch:'ajun', speaker:'阿琼', text:'巴依咖喱！家传秘方！虽然有几种香料找不到，我用本地的替代了，但味道应该差不不多！'},
    {text:'我尝了一口。辣。但不只是辣。先是一层温和的奶香，然后是各种说不出名字的香料依次登场，最后辣味才从舌根慢慢升起来。像是一首有起承转合的曲子。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'好吃。'},
    {ch:'ajun', speaker:'阿琼', text:'真的！？太好了！'},
    {text:'艾玛已经吃了三口，眼睛里冒着小星星。诺艾儿默默走过来坐下。'},
    {ch:'noelle', speaker:'诺艾儿', text:'给我也来一碗。'},
    {text:'她吃完了。而且把酱汁也蘸干净了。阿琼看着空碗，露出了一个比中了彩票还开心的笑容。', love:'ajun', loveD:1, freeRoam:true}
  ]
};

// 初遇艾诺（第二章 同龄人：冰系课堂基本课 → 艾诺门口拦住）
SCENES.s_aino_meet = {
  bg:'bg-school', phase:'academy',
  card:{vol:'第二卷', t:'第二章', s:'同龄人'},
  lines:[
    {text:'周三下午，冰系课程。这间教室小得寒碜，满打满算也就八个座位，透着一股「因为人少所以经费也不多」的凄凉感。'},
    {text:'最靠窗的位置坐着一个银白色长发的少女。她单手托腮，盯着窗外的一只麻雀发呆，浅蓝色的眸子静悄悄的，皮肤白得像是从没见过太阳。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……你好。'},
    {text:'她转过头，那眼神淡得像白开水。她轻轻点了下头，又把脸转回去了。'},
    {text:'冰系的老师姓霍尔，是个看起来随时想下班的中年男人。'},
    {ch:'hol', speaker:'霍尔', text:'冰是什么？冰就是不许动。你们得让魔力听话，让它把水锁死。把水冻成冰，要球形，越圆越好。做不到的，趁早转去水系。'},
    {text:'金发男生第一个动手。几秒后，一块长得像仙人掌的冰疙瘩顶破了瓶口。「不合格，下一个。」'},
    {text:'轮到我。圆滚滚的冰球悬在瓶子正中心，透亮得像颗大珍珠。'},
    {ch:'hol', speaker:'霍尔', text:'维斯特利亚家的？手挺稳。塔尔维，你也做一个。'},
    {text:'那个浅蓝色头发的女孩甚至没有看瓶子，只是伸出一根手指，朝桌面的方向随手一点。没有声音。但水已经不是水了。'},
    {text:'一颗完美的冰球悬在瓶中。表面光滑得像打过蜡，透明度几乎和玻璃一样，连一个气泡都没有。我甚至没看清她是什么时候完成的。'},
    {ch:'aino', speaker:'艾诺', text:'你的冰球，中心有个小气泡哦。'},
    {text:'我低头看了半天，才在最深处发现一个针尖大的白点。这人……眼睛是显微镜吗？'},
    {text:'下课后，艾诺在门口把我拦住了。'},
    {ch:'aino', speaker:'艾诺', text:'你是双亲和？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'嗯，水和冰。'},
    {ch:'aino', speaker:'艾诺', text:'我是单亲和，只有冰。在赫兰，冰魔法是用来活命的。所以我不明白，你刚才为什么要慢慢结冰？那样很浪费时间。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'慢一点的话，结构会更稳一点吧？'},
    {text:'她愣了一下，似乎在思考这个逻辑的合理性，最后点了点头。'},
    {ch:'aino', speaker:'艾诺', text:'我叫艾诺·塔尔维。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'希尔维亚·维斯特利亚。'},
    {ch:'aino', speaker:'艾诺', text:'我知道你，你姐姐在火系挺出名的。下周三见。别再弄出气泡了。'},
    {text:'这赫兰的冰系魔法师，难不成嘴巴也能冻人么。', know:'aino', knowD:8, love:'aino', loveD:1, freeRoam:true}
  ]
};

// 与艾诺比试（第四章 距离：冰墙术 → 花坊 → 食堂 → 比试）
SCENES.s_aino_sparring = {
  bg:'bg-school', phase:'academy',
  card:{vol:'第二卷', t:'第四章', s:'距离'},
  lines:[
    {text:'海伦娜走后的第三天，艾玛凑到我面前，眼睛瞪得圆圆的。'},
    {ch:'emma', speaker:'艾玛', text:'希尔维亚！你最近发呆的时间变长了！'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……有吗？'},
    {ch:'emma', speaker:'艾玛', text:'当然有！以前你发呆的时候，我叫你一声就回神了。现在要叫两三声！'},
    {ch:'sylvia', speaker:'希尔维亚', text:'可能是天气太好了。'},
    {ch:'emma', speaker:'艾玛', text:'骗人！你是不是想海伦娜了？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'……你要这么理解也行。'},
    {text:'海伦娜在的时候，确实很热闹。现在她走了，日子又恢复了原来的节奏。慢悠悠的，安静的，适合发呆的节奏。'},
    {text:'周三，冰系课程。今天学冰墙术。'},
    {ch:'hol', speaker:'霍尔', text:'冰墙，就是大一点的冰盾。你们自己琢磨。'},
    {text:'然后他就坐下了，翻开一本书看起来。书名是《极地美食指南》。上周那本是《北方冻原生存手册》，上上周是《雪地温泉一百选》。这个老师到底在搞什么跨界研究？'},
    {text:'我试着凝聚冰墙。既然是大一点的冰盾，那结构应该差不多——魔力在空气中铺展开来，凝结，成型。一面冰墙出现在面前。看起来还不错？我伸手敲了敲。声音清脆单薄，跟敲窗户玻璃似的。然后它自己裂了。'},
    {text:'「错了。」声音不是从讲台传来的。是从旁边。'},
    {ch:'aino', speaker:'艾诺', text:'冰墙不是放大版的冰盾。'},
    {text:'她蹲下来，手掌贴在地面上。「看好了。」魔力从她掌心流出，但不是往上，而是往下。地面微微震动，然后——一面冰墙从地底升起。像一棵树从土里长出来一样，稳稳当当。'},
    {ch:'aino', speaker:'艾诺', text:'冰墙要有根。就像树一样。你只看到地上的部分，但地下还有同样深的根系。没有根，就是一面立着的冰板——风一吹就倒，拳头一砸就碎。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'为什么书上没写？'},
    {ch:'aino', speaker:'艾诺', text:'书上写的都是理论。实战的时候，没有根的冰墙，一推就倒。'},
    {text:'我蹲下来，试着把魔力往地下引。这感觉很奇怪。像是要把水倒进看不见的杯子里。第二面冰墙升起来了。比第一面稳。'},
    {ch:'aino', speaker:'艾诺', text:'根不够深。至少再深一倍。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'我看不见地下的部分。'},
    {ch:'aino', speaker:'艾诺', text:'所以要用魔力感知，不是用眼睛。'},
    {text:'她说完转身回自己的位置。走了两步又回头。'},
    {ch:'aino', speaker:'艾诺', text:'周六下午，训练场。实战练习。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'和你？'},
    {ch:'aino', speaker:'艾诺', text:'不然呢？冰系就这么几个人，其他人都太弱了。你……勉强能打。'},
    {text:'这算是认可吗？还是说只是找不到更好的沙包？算了，反正闲着也是闲着。'},
    {bg:'bg-img-garden bg-garden', text:'下课后，我路过校园花坊。推开门，一股暖湿的空气扑面而来。然后我看见了一个不该出现在这里的人。'},
    {text:'艾诺蹲在角落，背对着门口，面前是一盆小小的蓝色的花。她正用手指小心翼翼地拨弄花瓣上的水滴，动作轻得像在碰一只蝴蝶的翅膀。和课堂上那个冷着脸的人完全判若两人。'},
    {ch:'aino', speaker:'艾诺', text:'……你来多久了？'},
    {ch:'sylvia', speaker:'希尔维亚', text:'刚到。'},
    {text:'她站起身，转过来，脸上的表情已经恢复成标准的冰系同学模样。但我注意到她的耳尖有一点点红。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'这花……'},
    {ch:'aino', speaker:'艾诺', text:'北极铃兰。赫兰公国的特产。只在极寒环境下开花。我用冰系魔法维持它的生长温度。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'你每天都来照顾它？'},
    {ch:'aino', speaker:'艾诺', text:'不是每天。只是路过。'},
    {text:'蹲在角落里拨弄花瓣叫「路过」。行吧。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'挺好看的。'},
    {ch:'aino', speaker:'艾诺', text:'……嗯。'},
    {ch:'aino', speaker:'艾诺', text:'你不许告诉别人。我在这里。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'好。'},
    {text:'她看了我一眼，似乎在确认我是不是真的会保密。然后她走了。经过我身边的时候，脚步停顿了一下。'},
    {ch:'aino', speaker:'艾诺', text:'……它叫伊诺。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'什么？'},
    {ch:'aino', speaker:'艾诺', text:'花的名字。和我同名。在赫兰语里，伊诺是「冬天的孩子」的意思。'},
    {text:'冬天的孩子。挺适合她的。', know:'aino', knowD:12, love:'aino', loveD:1},
    {bg:'bg-img-cafeteria bg-cafeteria', text:'食堂，老位置。'},
    {ch:'noelle', speaker:'诺艾儿', text:'这本书的重量可以当武器了吧。'},
    {text:'她抱着一本能砸死人的《高级魔法公式推导》，一边吃饭一边在草稿纸上写写画画。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'确实。上次有个男生想搭讪，我举起这本书，他就跑了。'},
    {ch:'noelle', speaker:'诺艾儿', text:'假的。但这本书确实很重。'},
    {text:'我看着她，突然问：「累吗？」她的笔停了一下。然后抬起头，用一种很奇怪的眼神看着我。'},
    {ch:'noelle', speaker:'诺艾儿', text:'你知道吗，你是第一个问我累不累的人。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'其他人都问什么？'},
    {ch:'noelle', speaker:'诺艾儿', text:'「你是怎么做到的」，「你有什么秘诀」，「你是不是偷看了答案」。好像我能考第一是因为作弊，而不是因为我把吃饭的时间都用来学习。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'所以你累吗？'},
    {text:'她沉默了。过了一会儿，轻声说：「累啊。累得要死。但是没办法。因为我是平民啊。你们贵族考不好，最多被家里骂两句。我考不好，就要滚回乡下种地。」'},
    {ch:'sylvia', speaker:'希尔维亚', text:'需要帮助吗？'},
    {ch:'noelle', speaker:'诺艾儿', text:'不需要施舍。'},
    {ch:'sylvia', speaker:'希尔维亚', text:'不是施舍。是交易。你教我怎么更有效地学习，我借书给你看。我家里书很多，都是外面买不到的珍本。'},
    {text:'她愣住了。「……真的？」'},
    {ch:'sylvia', speaker:'希尔维亚', text:'真的。因为我觉得你值得。'},
    {text:'她笑了。「成交。」她伸出手。我握住了。她的手很瘦，指尖有茧，但握手的力道很足。', love:'noelle', loveD:1, know:'noelle', knowD:5},
    {bg:'bg-plain', text:'周六，训练场。艾诺穿着训练服等在那里，白发高高扎起，整个人像一把出鞘的剑。'},
    {ch:'aino', speaker:'艾诺', text:'规则简单。只用冰系魔法，打中三次算赢。'},
    {text:'最后一个字还没说完，她已经动了。三根冰锥破土而出，快得离谱。我本能侧身闪避，右肩还是被擦过。'},
    {ch:'aino', speaker:'艾诺', text:'太慢了。战斗不是回合制比赛，不会有人喊「开始」再给你三秒准备时间。'},
    {text:'冰墙要有根。像树一样。我学以致用——魔力向下延伸，冰盾从地面长出来。她的冰锥撞上我的冰盾，碎的不是我的。'},
    {text:'但下一秒，脚下地面突然结冰，我脚底一滑——两根冰刺从侧面刺来。来不及立盾，勉强挡住一根，另一根擦着腰侧过去。'},
    {ch:'aino', speaker:'艾诺', text:'太依赖正面防御。敌人不会永远从前面来。'},
    {text:'她的进攻节奏越来越快——冰锥、冰刺、地面结冰、空中冰箭，四个方向同时施压。但我发现了：她冰锥从左侧飞来时，右手正在控制地面结冰——右侧有空档。'},
    {text:'我赌了。不闪不避，左手凝冰盾挡住冰锥，右手同时甩出一根冰矛。冰矛直奔她右肩——被一面凭空出现的薄冰挡住。她甚至没有用手。'},
    {ch:'aino', speaker:'艾诺', text:'思路对了。但速度差太多。你的魔力释放路径太长了——从脑子到手掌，经过五个节点。试试直接在目标位置凝聚，不经过手。'},
    {text:'第二轮。我试着不走手——直接在她身侧的空气中凝聚冰晶。有那么一瞬间，冰晶真的闪了一下。然后一根冰锥把我放倒了。'},
    {text:'3:1。那一分是我在倒地的瞬间，一颗冰弹从右侧空气中蹦出来，正好弹到她的手背上。'},
    {ch:'aino', speaker:'艾诺', text:'……这算命中。'},
    {text:'声音里好像有那么一丁点不情愿。'},
    {ch:'aino', speaker:'艾诺', text:'有进步。下周继续。……为什么要陪你练？无聊。冰系就这几个人，你是唯一一个不会哭的。', flag:'ch_aino_sparring', freeRoam:true}
  ]
};

SCENES.s_black_name = {
  bg:'bg-img-town bg-town', phase:'journey',
  lines:[
    {text:'告示栏。王室红印。伏诛。已殁。通缉。'},
    {text:'画像从女将军画成了女刺客。离十四岁越来越远。'},
    {text:'杂货铺门框：闭着的眼睛。光膜型长效。五枚金币。'},
    {text:'黑色头发。墨绿眼睛。'},
    {speaker:'希尔维亚', text:'眷寒渔。'},
    {do:()=>{ S.alias='眷寒渔'; ach('black_hair'); S.gold=Math.max(0,S.gold-5); }},
    {text:'干净到这个世界的墨水都没碰过的名字。', freeRoam:true}
  ]
};

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
const _enterLocRaw = enterLoc;
enterLoc = function(id){
  _enterLocRaw(id);
  // delay story so egg/ambient playLines can start first; only if still free
  setTimeout(()=>{
    if(S.freeRoam && !typing && !awaitingChoice) tryStoryAction();
  }, 200);
};

// ========== TITLE / BOOT ==========
function newGame(){
  S=baseState();
  S.season = seasonOf(S.month);
  Object.values(LOCS).forEach(L=>{ if(L.area==='公爵府' && ['nursery','hallway','parlor','garden','dining'].includes(L.id)) L.unlock=true; });
  show('title-screen',0); show('game-screen',1);
  runScene('s_start');
}
function continueGame(){
  if(!load()){ toast('没有存档'); return; }
  // re-unlock locs by phase
  Object.values(LOCS).forEach(L=>{
    if(L.area==='公爵府') L.unlock=true;
    if(S.phase==='academy'||S.phase==='journey'||S.phase==='finale'){
      if(L.area==='魔法大学') L.unlock=true;
    }
    if(S.phase==='journey'||S.phase==='finale'){
      if(['road','jikan','northforest','town','market'].includes(L.id)) L.unlock=true;
    }
  });
  show('title-screen',0); show('game-screen',1);
  updateHUD(); updateLocBar();
  if(S.freeRoam) enterFreeRoam();
  else playLines([{text:`（读取存档）${dateStr()} · ${LOCS[S.loc]?.name||''}`, freeRoam:true}]);
}

$('btn-new').onclick=()=>{ sfx('click'); newGame(); };
$('btn-continue').onclick=()=>{ sfx('click'); continueGame(); };
$('btn-title').onclick=()=>{ save(); show('game-screen',0); show('battle-screen',0); show('panel',0); show('title-screen',1); updateHUD(); };
$('btn-mute').onclick=()=>{ muted=!muted; localStorage.setItem(MUTE_KEY, muted?'1':'0'); $('btn-mute').textContent=muted?'🔇':'🔊'; };
$('btn-help').onclick=()=>show('help-screen',1);
$('btn-help-close').onclick=()=>show('help-screen',0);
$('btn-codex').onclick=()=>{
  show('codex',1);
  const got = ACH.filter(a=>S.ach[a.id]);
  $('codex-list').innerHTML = `
    <p style="margin-bottom:8px">结局 ${codex.endings?.length||0} · 成就 ${got.length}/${ACH.length}</p>
    <p style="opacity:.7;font-size:12px">未解锁内容不会显示。</p>
    <div style="margin-top:12px">${got.map(a=>`<div class="p-ach">🏆 ${a.name}</div>`).join('') || '（空）'}</div>`;
};
$('btn-codex-close').onclick=()=>show('codex',0);

// ending shortcut in free roam - advance time much / menu
// Add special next actions when age high
const _doNext = doNextTime;
doNextTime = function(){
  const ch = [];
  // 婴儿期（<1岁）显示"下一年"，否则显示"下个季度"
  const nextLabel = S.ageY < 1 ? '🍂 进入下一年' : '🍂 进入下个季度';
  ch.push({
    text: nextLabel,
    do: function(){
      // 婴儿期每次推进一年（4个季度），否则推进一个季度
      const steps = S.ageY < 1 ? 4 : 1;
      for(let i = 0; i < steps; i++) advanceSeason(1);
      if(checkStoryGates()) return;
      enterFreeRoam();
      var tip = dateStr() + '。风物换了季节。体力已恢复。\n点出口继续探索，或再开季度菜单。';
      var te = $('text');
      if(te) te.innerHTML = escapeText(tip);
      toast(dateStr() + ' · 体力已恢复');
      updateHUD();
      renderHotspots();
    }
  });
  ch.push({ text: '💤 休息（恢复体力）', do: function(){ doRest(); } });

  // 所有剧情已改为换季自动触发
  if(S.phase==='journey' || S.phase==='finale'){
    ch.push({text:'北林讨伐 ⚡3', do:function(){ if(!spendST(3)) return; startBattle({name:'灰棘狼群',emoji:'🐺',hp:50+S.lv*2,atk:6+S.tier*2,exp:35,gold:8},function(){ S.gold+=8; addExp(10); enterFreeRoam(); }); }});
  }
  ch.push({text:'取消', do:function(){ enterFreeRoam(); }});

  playLines([{text:'这个季度要做什么？\n（选「进入下个季度」会推进时间并恢复体力）', choices: ch}]);
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
  if(e.key==='Escape'){ show('panel',0); show('map-overlay',0); show('help-screen',0); show('codex',0); show('stats-overlay',0); }
  if(e.key===' ' || e.key==='Enter'){ if(!$('game-screen').classList.contains('hidden')) $('text-box').click(); }
  if((e.key==='p'||e.key==='P') && !$('game-screen').classList.contains('hidden')) openPanel('status');
  if((e.key==='m'||e.key==='M') && S.freeRoam) openMap();
});


// ===== merge full story from story.js =====
(function mergeStory(){
  const pack = (typeof STORY_SCENES !== 'undefined') ? STORY_SCENES : (typeof window!=='undefined' ? window.STORY_SCENES : null);
  if(!pack){ console.warn('[story] STORY_SCENES missing'); return; }
  Object.keys(pack).forEach(k=>{ SCENES[k] = pack[k]; });
  console.log('[story] merged scenes', Object.keys(SCENES).length);
})();

// boot
show('btn-continue', hasSave());
updateHUD();
console.log('[转生千金] ready · scenes', Object.keys(SCENES).length);
