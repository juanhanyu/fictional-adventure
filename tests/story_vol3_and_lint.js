'use strict';
// 第三卷全量场景、立绘伪装演出、自由探索交互与自动化小说审校器综合验收测试
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const h = require('./harness.js');

const win = h.win;
const $ = (id) => win.document.getElementById(id);
const ROOT = path.resolve(__dirname, '..');

let sd = 0;
win.setTimeout = (fn) => { if (++sd > 160000) { sd--; return 0; } try { fn(); } finally { sd--; } return 0; };
win.setInterval = () => 0;
win.clearInterval = () => 0;
win.clearTimeout = () => 0;
win.__setTypingDrain();

let fail = 0;
function ok(label, cond) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
}

const vis = (id) => { const el = $(id); return el && !el.classList.contains('hidden'); };

function driveCurrentScene(onStep) {
  for (let i = 0; i < 30000; i++) {
    if (typeof onStep === 'function') onStep();
    if (vis('cg-screen')) { const c = $('cg-screen'); if (typeof c.onclick === 'function') { c.onclick(); continue; } }
    if (vis('card')) { const c = $('card'); if (typeof c.onclick === 'function') { c.onclick(); continue; } }
    if (vis('pick-screen')) {
      const card = win.document.querySelector('#pick-grid .pick-card:not(.disabled)');
      if (card && typeof card.onclick === 'function') { card.onclick(); continue; }
    }
    if (vis('battle-screen')) {
      const doneBtn = $('cr-done');
      if (doneBtn) { doneBtn.click(); continue; }
      const skBtn = win.document.querySelector('#b-actions .cb-skill-card:not(:disabled), #b-actions .choice:not(:disabled)');
      if (skBtn) { skBtn.click(); continue; }
      const endBtn = $('cb-btn-endturn');
      if (endBtn) { endBtn.click(); continue; }
    }
    const chBox = $('choices');
    if ((win.__getAwaiting() || (chBox && chBox.children.length)) && chBox) {
      const cbtn = chBox.querySelector('.choice:not(:disabled)');
      if (cbtn && typeof cbtn.onclick === 'function') { cbtn.onclick(); continue; }
    }
    if (win.__drain.length) { win.__drain.shift()(); continue; }
    if (win.__getStoryChain()) continue;
    if (win.__getS().freeRoam) break;
    break;
  }
}

console.log('\n===== 第三卷全量场景 & 立绘交互 & 文风审校器综合测试 =====');

const VOL3_NEW_SCENES = [
  's_north_forest',
  's_glow_sheep',
  's_distant_wind_1',
  's_words_to_wind',
  's_eye_of_storm',
  's_leaky_cup',
];

// 1) index.html 引入与场景/章节表正序检查
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
ok('index.html 已引入 js/story-vol3.js', indexHtml.includes('js/story-vol3.js'));

const chapterIds = (win.__STORY_CHAPTERS || []).map((c) => c.id);
const vol3Indices = VOL3_NEW_SCENES.map((id) => chapterIds.indexOf(id));
for (const id of VOL3_NEW_SCENES) {
  const sc = win.SCENES[id];
  ok(`场景 ${id} 已注册且在章节目录中`, !!sc && chapterIds.includes(id));
  ok(`场景 ${id} 显式配置了合法 bgm (${sc && sc.bgm})`, !!(sc && sc.bgm && win.BGM_GROUPS[sc.bgm]));
}
ok('main 分支不包含额外原创草稿场景 s_distant_wind_2 / s_vol4_frost_watch / s_vol4_wind_echo',
  !win.SCENES.s_distant_wind_2 && !win.SCENES.s_vol4_frost_watch && !win.SCENES.s_vol4_wind_echo
  && !chapterIds.includes('s_distant_wind_2') && !chapterIds.includes('s_vol4_frost_watch') && !chapterIds.includes('s_vol4_wind_echo'));
const strictlyIncreasing = vol3Indices.every((idx, i) => idx >= 0 && (i === 0 || idx === vol3Indices[i - 1] + 1));
ok('STORY_CHAPTERS 中第三卷 6 章原著剧本保持严格正序排列（零倒序）', strictlyIncreasing);

// 2) 新增配角与「眷寒渔」伪装立绘资产及解析校验
const NEW_NPCS = ['masha', 'kyle', 'mage_aurora', 'axu', 'musa', 'jiqing', 'servant_a'];
const DISGUISE_EMOS = ['normal', 'smile', 'happy', 'serious', 'sad', 'surprised', 'sleepy', 'teary', 'wink'];

for (const npc of NEW_NPCS) {
  const rel = win.resolvePortrait(npc, 'normal');
  const abs = rel ? path.join(ROOT, rel) : '';
  ok(`新配角 ${npc} 拥有真实 PNG 立绘且已注册 (${rel})`, !!rel && fs.existsSync(abs) && fs.statSync(abs).size > 20000);
}

win.__resetS();
const pState = win.__getS();
pState.flags.named = 1;
pState.ageY = 15;
pState.alias = null;
ok('伪装前希尔维亚解析为学院银发立绘', win.resolvePortrait('sylvia', 'normal') === 'assets/portraits/sylvia_teenage_normal.webp');

pState.alias = '眷寒渔';
win.updateHUD();
const allDisguiseValid = DISGUISE_EMOS.every((emo) => {
  const rel = win.resolvePortrait('sylvia', emo);
  const abs = rel ? path.join(ROOT, rel) : '';
  return new RegExp('^assets/portraits/sylvia_disguise_' + emo + '\\.(webp|png)$').test(rel || '') && fs.existsSync(abs) && fs.statSync(abs).size > 20000;
});
ok('伪装身份「眷寒渔」全部 9 种表情均解析为黑发墨绿眼伪装立绘', allDisguiseValid);
ok('HUD 头像同步切换为黑发墨绿眼伪装立绘', ($('hud-face-img').getAttribute('src') || '').includes('sylvia_disguise_normal.webp'));

win.setSpeaker('渔', 'sylvia');
ok('对话框小胸像在「渔」说话时显示伪装立绘且无空 src', ($('tb-speaker-img').getAttribute('src') || '').includes('sylvia_disguise_normal.webp'));
win.setSpeaker('路人甲', null);
ok('无立绘路人说话时移除 img[src] 并隐藏小胸像（零破图图标）', !$('tb-speaker-img').hasAttribute('src') && $('tb-speaker-img').style.display === 'none');

// 3) 剧本颗粒度、零纯文本面板框、左右槽位稳定与转场回收检查
const MIN_BEATS = {
  s_north_forest: 115,
  s_glow_sheep: 65,
  s_distant_wind_1: 65,
  s_words_to_wind: 45,
  s_eye_of_storm: 50,
  s_leaky_cup: 35,
};
let boxBorderLeaks = 0;
let slotFlipIssues = 0;
let clearStageCount = 0;

for (const id of VOL3_NEW_SCENES) {
  const lines = win.SCENES[id]?.lines || [];
  ok(`${id} 演出节拍充实 (${lines.length} >= ${MIN_BEATS[id]})`, lines.length >= MIN_BEATS[id]);
  let prevPairKey = null;
  let prevOrder = null;

  for (const L of lines) {
    if (!L || typeof L !== 'object') continue;
    if (typeof L.text === 'string' && /[╔╚╠╣║═]/.test(L.text)) {
      boxBorderLeaks++;
    }
    if (Array.isArray(L.portraits) && L.portraits.length === 0) {
      clearStageCount++;
    }
    if (Array.isArray(L.portraits) && L.portraits.length === 2) {
      const ids = L.portraits.map((p) => p.id);
      const pairKey = [...ids].sort().join('+');
      const order = ids.join('>');
      if (pairKey === prevPairKey && order !== prevOrder) {
        slotFlipIssues++;
      }
      prevPairKey = pairKey;
      prevOrder = order;
    } else if (Array.isArray(L.portraits) && L.portraits.length === 0) {
      prevPairKey = null;
      prevOrder = null;
    }
  }
}
ok('第三卷全部新场景零纯文本面板框字符', boxBorderLeaks === 0);
ok('双人立绘对话段保持左右槽位绝对稳定（零来回换位）', slotFlipIssues === 0);
ok('转场桥段包含显式立绘回收 (portraits:[])', clearStageCount >= 20);

// 4) s_north_forest 戏肉细节、战术选择、可玩战斗与 Lv.38 状态面板校验
win.__resetS();
win.__captureSysPopup();
win.__drain.length = 0;
let sawNfChoice = false;
let sawNfBattle = false;
const nfAllText = win.SCENES.s_north_forest.lines.map((l) => l.text || '').join('\n');
ok('s_north_forest 完整还原甩面条/第73下/工业级搓背/给失败做预算/罚三铜板/老树题眼',
  nfAllText.includes('拉面师傅甩面条') &&
  nfAllText.includes('第七十三下') &&
  nfAllText.includes('工业级') &&
  nfAllText.includes('给失败做预算') &&
  nfAllText.includes('三枚铜板') &&
  nfAllText.includes('明天还在。后天也在。'));

win.__runScene('s_north_forest');
driveCurrentScene(() => {
  if (win.__getAwaiting() || ($('choices') && $('choices').children.length)) sawNfChoice = true;
  if (vis('battle-screen')) sawNfBattle = true;
});
const nfState = win.__getS();
const nfStatusPop = (win.__capturedPopups || []).find((p) => /状态面板/.test(p.title));
ok('s_north_forest 触发战术抉择与霜脊影豺实战战斗并完整进 freeRoam', sawNfChoice && sawNfBattle && nfState.freeRoam === true && !!nfState.flags.ch_north_forest);
ok('s_north_forest 生日定格 15 岁且深绿发带放在枕边（未塞入工具背包）',
  nfState.ageY === 15 && !!nfState.ach.birthday_15 && !!nfState.flags.kept_green_ribbon_by_pillow && !nfState.inv.some((i) => i.id === 'green_ribbon'));
ok('s_north_forest 弹出实时 statusPanelHTML() 面板 (Lv.38 且法抗 S.mdef=49 准确无误)',
  !!nfStatusPop && nfStatusPop.body.includes('<b>等级</b> Lv.38') && nfStatusPop.body.includes('<b>法抗</b> 49') && nfState.mdef >= 49);

// 5) 澄岚公会玛莎舞台点击交谈校验
win.enterLoc('chenglan_guild');
const mashaSlot = $('p-left');
ok('澄岚公会自由探索展示玛莎立绘且可点击交互',
  !mashaSlot.classList.contains('hidden') && (mashaSlot.querySelector('img').getAttribute('src') || '').includes('masha_normal.webp'));
mashaSlot.onclick({ stopPropagation() {}, detail: 0 });
driveCurrentScene();
ok('点击舞台上的玛莎成功触发对话并增加了解度', (win.__getS().know.masha || 0) > 0 && win.__getS().freeRoam === true);

// 6) s_glow_sheep 任务弹窗与狂奔大笑演出校验
win.__resetS();
win.__resetSysPopup();
win.__drain.length = 0;
const sheepSrc = win.SCENES.s_glow_sheep.lines.map((l) => l.text || '').join('\n');
ok('s_glow_sheep 逐句包含「向前跑吧」高潮呼喊', sheepSrc.includes('向前跑吧') && sheepSrc.includes('一直、一直向前跑吧'));
win.__runScene('s_glow_sheep');
driveCurrentScene();
const gsState = win.__getS();
const sheepQuestPop = (win.__capturedPopups || []).find((p) => /数羊/.test(p.title));
ok('s_glow_sheep 使用系统弹窗呈现「数羊」1经验任务并解锁成就', !!sheepQuestPop && sheepQuestPop.body.includes('×1') && !!gsState.ach.glow_sheep_night);

// 7) POV 视角演出与 s_leaky_cup 爱丽丝直接台词校验
const leakyAliceLines = win.SCENES.s_leaky_cup.lines.filter((l) => l && l.speaker === '爱丽丝');
ok(`s_leaky_cup 包含醒着的爱丽丝直接对话演出 (${leakyAliceLines.length} 句 >= 6)`, leakyAliceLines.length >= 6);

for (const [scId, expectedPov] of [
  ['s_words_to_wind', 'alice'],
  ['s_eye_of_storm', 'fengshen'],
  ['s_leaky_cup', 'fengshen'],
]) {
  ok(`${scId} 配置了 pov:'${expectedPov}'`, win.SCENES[scId].pov === expectedPov);
  win.__resetS();
  win.__drain.length = 0;
  let sawPovHidden = false;
  win.__runScene(scId);
  driveCurrentScene(() => {
    if (win.document.body.classList.contains('pov-hidden')) sawPovHidden = true;
  });
  ok(`${scId} 播放中隐藏顶部 HUD 且结束后自动恢复`, sawPovHidden && !win.document.body.classList.contains('pov-hidden') && win.__getS().freeRoam === true);
}

// 8) s_distant_wind_1 时序锁、课程防穿帮与冰封峡谷自由探索校验
win.__resetS();
win.__LOCS.ice_canyon.unlock = false;
win.__drain.length = 0;
const dw1Text = win.SCENES.s_distant_wind_1.lines.map((l) => l.text || '').join('\n');
ok('s_distant_wind_1 还原大雨三天三夜吹牛、拔剑冻墨水瓶与酒馆六瓣冰花',
  dw1Text.includes('三天三夜') && dw1Text.includes('墨水瓶') && dw1Text.includes('冰花'));
win.__runScene('s_distant_wind_1');
driveCurrentScene();
const dw1 = win.__getS();
const dw1Courses = win.availableCourses().map((c) => c.id);
ok('s_distant_wind_1 获得乌木铁剑并在跨越赫兰界碑后解锁冰封峡谷自由探索',
  dw1.inv.some((i) => i.id === 'ebony_sword') && win.__LOCS.ice_canyon.unlock === true && dw1.freeRoam === true);
ok('离开霁馆后课程列表不再跨国召唤霁馆主（解锁覆冰剑技与冻土防务）',
  !dw1Courses.includes('dojo_foot') && !dw1Courses.includes('dojo_blade') && dw1Courses.includes('border_blade') && dw1Courses.includes('helan_tactics'));

// 验证冰封峡谷自由探索中艾诺台词、课程与修行不穿帮
win.enterLoc('ice_canyon');
const ainoPoolJoin = Array.from({ length: 12 }, () => win.talkLines('aino').map((l) => l.text || '').join('')).join('\n');
const ainoGreet = win.roamGreetingText('aino', 'ice_canyon');
ok('冰封峡谷艾诺问候与对话全为前线语境（零花坊/周六训练场穿帮）',
  !ainoPoolJoin.includes('花坊') && !ainoPoolJoin.includes('周六训练场') && ainoGreet.includes('风口'));
const expBeforeTrain = dw1.exp;
dw1.st = dw1.mst;
win.doTrain();
driveCurrentScene();
ok('冰封峡谷执行「修行」获得专属冻土实战经验与体能成长', win.__getS().exp > expBeforeTrain && win.__getS().freeRoam === true);

// 9) Python 文风与违禁词审校器 (tools/novel_linter.py) 默认无参扫描与严格拦截校验
const beatsPath = path.join(ROOT, 'novel', 'beats', 'vol3_ch4_2_beats.md');
const novelPath = path.join(ROOT, 'novel', '第三卷_第四章_远行的风（下）.md');
ok('main 分支不含额外原创草稿 novel/ 目录文件', !fs.existsSync(beatsPath) && !fs.existsSync(novelPath));
ok('js/story-vol3.js 严格做到全文 0 匹配「修为」',
  !fs.readFileSync(path.join(ROOT, 'js', 'story-vol3.js'), 'utf8').includes('修为'));

// 默认无位置参数调用：`python3 tools/novel_linter.py --strict`
const pyBin = process.platform === 'win32' ? 'python' : 'python3';
const defaultCleanRun = spawnSync(
  pyBin,
  [path.join(ROOT, 'tools', 'novel_linter.py'), '--strict'],
  { encoding: 'utf8', cwd: ROOT }
);
let cleanReport = null;
try { cleanReport = JSON.parse(defaultCleanRun.stdout); } catch (e) {}
ok('无参调用 novel_linter.py --strict 自动扫描全量叙事 JS 且 0 违规 (exit 0)',
  defaultCleanRun.status === 0 && cleanReport && cleanReport.ok === true && cleanReport.summary.files_scanned >= 2 && cleanReport.summary.total_issues === 0);

// 构造违禁样本反向测试（含不加 --strict 时的非零退出码、修为、老夫拱手、段内短碎句）
const badSamplePath = path.join(os.tmpdir(), `novel_linter_bad_${process.pid}.md`);
fs.writeFileSync(
  badSamplePath,
  [
    '这不是普通铁剑，而是神器。',
    '老夫拱手道谢，从外面看没有别的法子，她冻出冰刺，想把威力提上去。',
    '直到修为跨过界限，丹田里灵气化作真气，这位天骄修士祭出功法。',
    '零点五秒内，三十七度的热流飞出二十五米，百分之九十命中。',
    '风停了。雪落了。人走了。夜黑了。',
    '她轻轻地抬手，轻轻地握剑，轻轻地呼吸。',
    '慌乱中打碎了花瓶，烧焦了窗帘，还拿反了地图。',
  ].join('\n\n'),
  'utf8'
);
const badNonStrictRun = spawnSync(
  pyBin,
  [path.join(ROOT, 'tools', 'novel_linter.py'), badSamplePath],
  { encoding: 'utf8', cwd: ROOT }
);
try { fs.unlinkSync(badSamplePath); } catch (e) {}
let badReport = null;
try { badReport = JSON.parse(badNonStrictRun.stdout); } catch (e) {}
const expectedRules = [
  'no_bushi',
  'no_slang_mechanic',
  'no_xianxia',
  'no_precise_numbers',
  'no_telegraph_staccato',
  'no_close_repetition',
  'no_recycled_gags',
];
ok('novel_linter.py (含非 --strict 模式) 对违禁样本返回非零退出码且检出全部 7 类规则',
  badNonStrictRun.status !== 0 && badReport && expectedRules.every((r) => (badReport.summary.by_rule[r] || 0) >= 1));

console.log(fail === 0 ? '\n  ✓ 第三卷全量场景与审校器测试全部通过' : `\n  ✗ ${fail} 处失败`);
process.exit(fail ? 1 : 0);
