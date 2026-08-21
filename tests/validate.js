'use strict';
// 静态剧情数据校验器：跑在 harness 载入的 window 上
const fs = require('fs');
const path = require('path');
const h = require('./harness.js');
const win = h.win;
const ROOT = path.resolve(__dirname, '..');

const SCENES = win.SCENES;
const LOCS = win.__LOCS;
const CHARS = win.__CHARS;
const styleCss = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const gameJs = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

const issues = [];
function report(kind, scene, msg){ issues.push({kind, scene, msg}); }

// style.css 中定义的所有 .bg-* 类
const bgClasses = new Set();
styleCss.replace(/\.(bg-[\w-]+)/g, (m, c)=> bgClasses.add(c));
const bgImgClasses = new Set([...bgClasses].filter(c=>c.startsWith('bg-img-')));
const bgToneClasses = new Set([...bgClasses].filter(c=>!c.startsWith('bg-img-')));

// 1) 门控 queue.push 引用的场景必须存在
const gateRefs = new Set();
let re = /queue\.push\('([\w_]+)'\)/g, m;
while((m=re.exec(gameJs))) gateRefs.add(m[1]);
// runScene / goto 引用
const gotoRefs = new Set();
re = /runScene\('([\w_]+)'\)/g; while((m=re.exec(gameJs))) gotoRefs.add(m[1]);
re = /runScene\('([\w_]+)'\)/g; while((m=re.exec(gameJs))) gotoRefs.add(m[1]);
re = /goto:\s*'([\w_]+)'/g; while((m=re.exec(gameJs))) gotoRefs.add(m[1]);

gateRefs.forEach(id=>{ if(!SCENES[id]) report('GATE_MISSING', 'checkStoryGates', `门控引用场景「${id}」未定义`); });
gotoRefs.forEach(id=>{ if(!SCENES[id]) report('GOTO_MISSING', '(src)', `runScene/goto 引用「${id}」未定义`); });

// 2) 剧情内 runScene/goto 引用（在 scenes 数据里）
const CHAPTER_IDS = (win.__STORY_CHAPTERS||[]).map(c=>c.id);

// 抽象/纯氛围色调类：允许单独使用（虚空、夜色、选卡、战斗、决斗、结局等过渡）
const ABSTRACT_TONES = new Set(['bg-void','bg-night','bg-pick','bg-battle','bg-duel','bg-ending']);
function bgCheck(where, bgCls, scene){
  const cls = bgCls.split(/\s+/);
  for(const c of cls) if(!bgClasses.has(c)) report('BAD_BG', scene, `${where} bg 类「${c}」未在 style.css 定义`);
  const hasImg = cls.some(c=>bgImgClasses.has(c));
  if(!hasImg && !cls.every(c=>ABSTRACT_TONES.has(c))){
    report('BG_NO_IMG', scene, `${where} bg「${bgCls}」缺 bg-img-*（且非抽象氛围类）`);
  }
}

function checkLine(scene, L, where){
  if(!L || typeof L !== 'object') return;
  if(typeof L.text === 'string'){
    if(!L.text.trim()) report('EMPTY_TEXT', scene, `${where} text 为空`);
  }
  if(L.bg){ bgCheck(where, L.bg, scene); }
  if(L.loc && !LOCS[L.loc]) report('BAD_LOC', scene, `${where} loc「${L.loc}」不是合法 LOCS key`);
  if(L.ch && !CHARS[L.ch]) report('BAD_CH', scene, `${where} ch「${L.ch}」未在 CHARS 登记`);
  if(L.portraits){
    for(const p of L.portraits){
      if(!CHARS[p.id]) report('BAD_PCHAR', scene, `${where} portraits 角色「${p.id}」未登记`);
      if(p.emo && !['normal','happy','sad','shy','smile','serious','surprised','wink','teary','sleepy'].includes(p.emo)) report('BAD_EMO', scene, `${where} portraits emo「${p.emo}」非法`);
      if(p.slot && !['left','center','right','fourth'].includes(p.slot)) report('BAD_SLOT', scene, `${where} slot「${p.slot}」非法`);
    }
  }
  if(L.goto && !SCENES[L.goto]) report('BAD_GOTO', scene, `${where} goto「${L.goto}」场景未定义`);
  if(L.choices){
    const list = typeof L.choices==='function' ? [] : L.choices; // 函数型无法静态检查
    if(Array.isArray(list)) list.forEach((c,i)=>{
      if(c.goto && !SCENES[c.goto]) report('BAD_GOTO', scene, `${where} choice[${i}].goto「${c.goto}」未定义`);
      if(c.lines) checkLines(scene, c.lines, `${where} choice[${i}]`);
    });
  }
}
function checkLines(scene, lines, where){
  (Array.isArray(lines)?lines:[]).forEach((L,i)=>checkLine(scene, L, `${where}L${i}`));
}

Object.keys(SCENES).forEach(id=>{
  const sc = SCENES[id];
  if(sc.bg){ bgCheck('', sc.bg, id); }
  if(sc.loc && !LOCS[sc.loc]) report('BAD_LOC', id, `场景 loc「${sc.loc}」非法`);
  checkLines(id, sc.lines, '');
});

// 3) 章节目录 id 对应的场景
CHAPTER_IDS.forEach(id=>{
  // s_ending_menu 允许无场景（结局分岔，结局系统已移除）
  if(id==='s_ending_menu') return;
  if(!SCENES[id]) report('CHAPTER_NO_SCENE', id, `章节目录包含「${id}」但无对应场景`);
});

// 4) PORTRAIT_FILES 引用的文件必须存在于磁盘
const PORTRAIT_FILES = win.__PORTRAIT_FILES || {};
Object.entries(PORTRAIT_FILES).forEach(([k, fp])=>{
  const abs = path.join(ROOT, fp);
  if(!fs.existsSync(abs)) report('PORTRAIT_MISSING', k, `立绘文件不存在: ${fp}`);
});

// 输出
const byKind = {};
issues.forEach(i=>{ byKind[i.kind]=(byKind[i.kind]||0)+1; });
console.log('\n===== 场景数据校验报告 =====');
console.log('场景总数:', Object.keys(SCENES).length, '| 门控引用:', gateRefs.size, '| 问题总数:', issues.length);
console.log('按类别:', JSON.stringify(byKind, null, 0));
issues.forEach(i=>console.log(`  [${i.kind}] ${i.scene}: ${i.msg}`));
module.exports = { issues, byKind };
// 退出码：有问题则非 0
if(issues.length){ process.exitCode = 1; }
