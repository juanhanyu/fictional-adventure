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
ok('BGM_GROUPS 含 battle', Array.isArray(groups.battle) && groups.battle.length>=1);
ok('BGM_GROUPS 含 sacred 两首', Array.isArray(groups.sacred) && groups.sacred.length===2);
ok('BGM_GROUPS 含 academy 两首', Array.isArray(groups.academy) && groups.academy.length===2);
ok('BGM_GROUPS 含 peaceful 两首', Array.isArray(groups.peaceful) && groups.peaceful.length===2);
ok('BGM_GROUPS 含 cheerful 两首', Array.isArray(groups.cheerful) && groups.cheerful.length===2);
ok('BGM_GROUPS 含 relax 两首', Array.isArray(groups.relax) && groups.relax.length===2);
ok('BGM_GROUPS 含 sad', Array.isArray(groups.sad) && groups.sad.length>=1);

// ---- ③ 所有曲目文件存在 ----
const files = win.BGM_FILES || {};
ok('BGM_FILES 定义曲目', Object.keys(files).length>=14);
let missing = [];
Object.entries(files).forEach(([key, fp])=>{
  if(!fs.existsSync(path.join(ROOT, fp))) missing.push(fp);
});
ok('所有 BGM 文件在磁盘上存在', missing.length===0);
if(missing.length) missing.forEach(m=>console.log('    缺失: '+m));

// ---- ④ 每个场景都必须显式配置 bgm（全覆盖，禁止依赖推断兜底）----
const SCENES = win.SCENES || {};
let noExplicitBgm = [];
Object.keys(SCENES).forEach(id=>{
  const sc = SCENES[id];
  if(!sc.bgm) noExplicitBgm.push(id);
});
ok('每个场景都显式配置了 bgm（共 '+Object.keys(SCENES).length+' 场景）', noExplicitBgm.length===0);
if(noExplicitBgm.length) noExplicitBgm.forEach(id=>console.log('    无显式bgm: '+id));

console.log('\n失败:', fail);
process.exit(fail?1:0);
