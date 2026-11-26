'use strict';
// BGM 测试：① 自由探索按背景全覆盖（每个背景类都有类型）② 类型分组轮换 ③ 所有曲目文件存在 ④ 场景可显式指定 bgm
const h = require('./harness.js');
const fs = require('fs');
const path = require('path');
const win = h.win;
const ROOT = path.resolve(__dirname, '..');

let fail = 0;
function ok(label, cond){ console.log(`  ${cond?'✓':'✗'} ${label}`); if(!cond) fail++; }
function typeFor(cls, phase, loc){ return win.bgmTypeForBg(cls||'', phase||'childhood', loc||'nursery'); }

// ---- ① 全覆盖：所有背景类都能映射到类型 ----
const allBgClasses = [
  'bg-battle','bg-pick','bg-duel','bg-title','bg-void','bg-night','bg-snow','bg-forest',
  'bg-beach','bg-plain','bg-room','bg-hall','bg-school','bg-garden','bg-study','bg-town','bg-ending',
  'bg-img-nursery','bg-img-hallway','bg-img-parlor','bg-img-garden','bg-img-study','bg-img-dining',
  'bg-img-kitchen','bg-img-training','bg-img-balcony','bg-img-chapel','bg-img-cellar','bg-img-town',
  'bg-img-beach','bg-img-dorm','bg-img-classroom','bg-img-ice-classroom','bg-img-library','bg-img-cafeteria',
  'bg-img-clocktower','bg-img-flowerhouse','bg-img-memorial','bg-img-auditorium','bg-img-forest',
  'bg-img-jikan','bg-img-uni','bg-img-plain','bg-img-village','bg-img-castle','bg-img-crosswalk-accident',
  'bg-img-classroom-locust','bg-img-training','bg-img-nursery'
];
let uncovered = [];
allBgClasses.forEach(c=>{ if(!typeFor(c)) uncovered.push(c); });
ok('所有背景类都有对应 bgm 类型（全覆盖）', uncovered.length===0);
if(uncovered.length) uncovered.forEach(c=>console.log('    无类型: '+c));

// ---- 情境抽查 ----
const t = (cls,ph,loc)=>typeFor(cls,ph,loc);
ok('bg-battle → battle', t('bg-battle')==='battle');
ok('bg-pick → sacred', t('bg-pick')==='sacred');
ok('bg-img-forest → sad', t('bg-img-forest bg-forest','academy','northforest')==='sad');
ok('bg-img-beach → cheerful', t('bg-img-beach bg-beach','academy','beach')==='cheerful');
ok('bg-img-auditorium → sacred', t('bg-img-auditorium bg-hall','academy','auditorium')==='sacred');
ok('bg-night → relax', t('bg-night','academy')==='relax');
ok('bg-img-classroom → academy', t('bg-img-classroom bg-school','academy','water_class')==='academy');
ok('bg-img-library → academy', t('bg-img-library bg-study','academy','library')==='academy');
ok('bg-img-garden → cheerful', t('bg-img-garden bg-garden','childhood','garden')==='cheerful');
ok('bg-img-study → peaceful', t('bg-img-study bg-study','childhood','study')==='peaceful');
ok('bg-img-nursery → peaceful', t('bg-img-nursery bg-room','prologue','nursery')==='peaceful');
ok('bg-img-dining → cheerful', t('bg-img-dining bg-hall','childhood','dining')==='cheerful');
ok('bg-img-jikan → peaceful', t('bg-img-jikan bg-room','journey','jikan')==='peaceful');
ok('bg-void → sad', t('bg-void','childhood')==='sad');
ok('bg-snow → relax', t('bg-snow','finale')==='relax');
ok('兜底 → peaceful', t('bg-img-title bg-title','prologue')==='peaceful');

// ---- ② 类型分组正确 ----
const groups = win.BGM_GROUPS || {};
ok('BGM_GROUPS 含 title（雪晶序曲）', Array.isArray(groups.title) && groups.title.includes('title_overture'));
ok('BGM_GROUPS 含 battle', Array.isArray(groups.battle) && groups.battle.length>=1);
ok('BGM_GROUPS 含 sacred 两首', Array.isArray(groups.sacred) && groups.sacred.length===2);
ok('BGM_GROUPS 含 academy 两首', Array.isArray(groups.academy) && groups.academy.length===2);
ok('BGM_GROUPS 含 peaceful 两首', Array.isArray(groups.peaceful) && groups.peaceful.length===2);
ok('BGM_GROUPS 含 cheerful 两首', Array.isArray(groups.cheerful) && groups.cheerful.length===2);
ok('BGM_GROUPS 含 relax 两首', Array.isArray(groups.relax) && groups.relax.length===2);
ok('BGM_GROUPS 含 sad', Array.isArray(groups.sad) && groups.sad.length>=1);

// ---- ②.5 主界面主题曲升级与资产守卫 ----
ok('TITLE_BGM_KEY 永久锁定为 title_overture', win.TITLE_BGM_KEY === 'title_overture');
ok('TITLE_BGM_TITLE 为 雪晶序曲', win.TITLE_BGM_TITLE === '雪晶序曲');
const titleFile = (win.BGM_FILES || {}).title_overture;
ok('BGM_FILES.title_overture 指向 Music/Luminous Snow-Crystal.mp3', titleFile === 'Music/Luminous Snow-Crystal.mp3');
ok('Music/Luminous Snow-Crystal.mp3 存在于磁盘', fs.existsSync(path.join(ROOT, 'Music/Luminous Snow-Crystal.mp3')));

// ---- ③ 所有曲目文件存在与响度平衡表覆盖 ----
const files = win.BGM_FILES || {};
ok('BGM_FILES 定义全部 19 首曲目', Object.keys(files).length >= 19);
let missing = [];
Object.entries(files).forEach(([key, fp])=>{
  if(!fs.existsSync(path.join(ROOT, fp))) missing.push(fp);
});
ok('所有 BGM 文件在磁盘上存在', missing.length===0);
if(missing.length) missing.forEach(m=>console.log('    缺失: '+m));

const trackGain = win.BGM_TRACK_GAIN || {};
const missingGain = Object.keys(files).filter(k => !(typeof trackGain[k] === 'number' && trackGain[k] > 0 && trackGain[k] <= 1));
ok('BGM_TRACK_GAIN 覆盖全部 19 首且增益在 (0, 1]', missingGain.length === 0);
if(missingGain.length) console.log('    缺失或异常增益: ' + missingGain.join(', '));

// ---- ④ 每个场景都必须显式配置 bgm（全覆盖，禁止依赖推断兜底）----
const SCENES = win.SCENES || {};
let noExplicitBgm = [];
Object.keys(SCENES).forEach(id=>{
  const sc = SCENES[id];
  if(!sc.bgm) noExplicitBgm.push(id);
});
ok('每个场景都显式配置了 bgm（共 '+Object.keys(SCENES).length+' 场景）', noExplicitBgm.length===0);
if(noExplicitBgm.length) noExplicitBgm.forEach(id=>console.log('    无显式bgm: '+id));

// ---- ⑤ 《海与贝壳》s_beach 开头 cheerful + 高光中段切 romantic ----
const beachScene = SCENES.s_beach;
ok('s_beach 开头保持 cheerful 且中段含 romantic 切曲',
  !!(beachScene && beachScene.bgm === 'cheerful' && Array.isArray(beachScene.lines) && beachScene.lines.some(ln => ln && ln.bgm === 'romantic')));

// ---- ⑥ 播放器 Bug 1 / Bug 2 / Bug 3 回归守卫 ----
// Bug 2：直接 bgmPlay(key) 反向同步 bgmCurType
win.bgmPlay('battle1', { fade: false });
const stAfterDirectPlay = win.bgmGetState();
ok('Bug 2 修复：bgmPlay 直接播指定曲时同步更新 state.type', stAfterDirectPlay.key === 'battle1' && stAfterDirectPlay.type === 'battle');

// Bug 1：bgmStop(false, { preserveContext: true }) 保留 sceneType 与 overlays
win.bgmSceneStart('peaceful');
win.bgmEnterOverlay('arena', 'academy', { force: false, fade: false });
win.bgmStop(false, { preserveContext: true });
const stAfterPreserveStop = win.bgmGetState();
ok('Bug 1 修复：bgmStop({preserveContext:true}) 停止播放但保留 sceneType 与 overlays',
  stAfterPreserveStop.key === null
  && stAfterPreserveStop.type === null
  && stAfterPreserveStop.sceneType === 'peaceful'
  && Array.isArray(stAfterPreserveStop.overlays)
  && stAfterPreserveStop.overlays.includes('arena'));
win.bgmStop(false);

// Bug 3：已在播 battle 且未暂停时进战不再强行轮换曲目
win.bgmPlay('battle1', { fade: false });
const audioEl = win.document.getElementById('bgm-audio');
if (audioEl) {
  try { Object.defineProperty(audioEl, 'paused', { value: false, configurable: true }); } catch(e) {}
}
if (win.CombatEngine && typeof win.CombatEngine.startStage === 'function') {
  win.CombatEngine.startStage('beatrice_11', { headless: false, usePreset: true });
  const stInBattle = win.bgmGetState();
  ok('Bug 3 修复：剧情已切 battle 且播放中，进战不强行轮换至 battle2', stInBattle.type === 'battle' && stInBattle.key === 'battle1');
  if (typeof win.CombatEngine.exitBattle === 'function') win.CombatEngine.exitBattle(false);
}
win.bgmStop(false);

console.log('\n失败:', fail);
process.exit(fail?1:0);
