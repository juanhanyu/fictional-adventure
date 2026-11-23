'use strict';
/**
 * M1 / M3.1 / M5 UI 精修与商业化 Galgame 体验回归防火墙
 * 覆盖：#cg-bg cover、index.html 资产与零重复 ID、标题按钮对齐、9 大弹窗 Esc 全关闭、
 *       Auto/Skip(未读刹车)/打字机速度/BGM&SFX 独立音量持久化、四合一典藏图鉴馆 & Lightbox、
 *       PORTRAIT_DIFF_PROTOCOL 优雅降级、EXITS.jikan 防遮挡。
 */
const fs = require('node:fs');
const path = require('node:path');
const { win, errors } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const doc = win.document;
const $ = (id) => doc.getElementById(id);
const vis = (id) => {
  const el = $(id);
  return !!(el && !el.classList.contains('hidden') && el.style.display !== 'none');
};

if (win.HTMLMediaElement && win.HTMLMediaElement.prototype) {
  win.HTMLMediaElement.prototype.play = () => Promise.resolve();
  win.HTMLMediaElement.prototype.pause = () => {};
}

const VN = win.VNUx;
const RE = win.RelicsAndEvents;

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (cond) pass++;
  else fail++;
}

function pressEscape() {
  doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
}

console.log('\n===== M1 / M3.1 / M5 UI 与体验精修回归守卫 =====');

// 1) CSS #cg-bg 使用 cover 而非 contain
const styleCss = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const cgRuleMatch = styleCss.match(/#cg-bg\s*\{[^}]*\}/);
const allCssDir = ['style.css', 'css/combat.css', 'css/ai-branching.css', 'css/gameplay-v2.css', 'css/ambient-fx.css', 'css/system-chronicle.css'];
const anyCgContain = allCssDir.some((rel) => {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return false;
  const txt = fs.readFileSync(abs, 'utf8');
  const m = txt.match(/#cg-bg\s*\{[^}]*\}/g) || [];
  return m.some((block) => /background-size\s*:\s*contain/i.test(block));
});
ok('#cg-bg 样式使用 background-size: cover 且全局无 contain 覆盖',
  !!(cgRuleMatch && /background-size\s*:\s*cover/i.test(cgRuleMatch[0]) && !anyCgContain),
  cgRuleMatch ? cgRuleMatch[0] : 'missing #cg-bg');

// 2) index.html 存在 #btn-rumor、零重复 ID、按序加载新 CSS/JS
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const htmlNoComments = indexHtml.replace(/<!--[\s\S]*?-->/g, '');
const idCounts = {};
for (const m of htmlNoComments.matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)) {
  idCounts[m[1]] = (idCounts[m[1]] || 0) + 1;
}
const dupIds = Object.keys(idCounts).filter((k) => idCounts[k] > 1);
ok('index.html 存在 #btn-rumor 入口且全页零重复元素 ID',
  !!$('btn-rumor') && idCounts['btn-rumor'] === 1 && dupIds.length === 0,
  dupIds.length ? 'duplicates: ' + dupIds.join(', ') : '');

const requiredAssets = [
  'href="css/ambient-fx.css"',
  'href="css/system-chronicle.css"',
  'src="js/story-vol4.js"',
  'src="js/ambient-fx.js"',
];
const allAssetsLoaded = requiredAssets.every((tok) => indexHtml.includes(tok));
const volOrderOk = indexHtml.indexOf('src="js/story-vol3.js"') < indexHtml.indexOf('src="js/story-vol4.js"')
  && indexHtml.indexOf('src="js/story-vol4.js"') < indexHtml.indexOf('src="game.js"');
const fxOrderOk = indexHtml.indexOf('src="js/ambient-fx.js"') < indexHtml.indexOf('src="js/vn-ux.js"');
ok('index.html 正确按依赖顺序加载 ambient-fx.css / system-chronicle.css / story-vol4.js / ambient-fx.js',
  allAssetsLoaded && volOrderOk && fxOrderOk,
  `loaded=${allAssetsLoaded}, volOrder=${volOrderOk}, fxOrder=${fxOrderOk}`);

// 3) 标题页注入按钮 (#btn-title-loads / #btn-title-chapters) 视觉规范对齐 #btn-new
const btnNew = $('btn-new');
const btnLoads = $('btn-title-loads');
const btnChaps = $('btn-title-chapters');
ok('标题页注入按钮 #btn-title-loads 与 #btn-title-chapters 均具备 tbtn-editorial 与 .tbtn-text',
  !!(btnNew && btnNew.classList.contains('tbtn-editorial') && btnNew.querySelector('.tbtn-text')
    && btnLoads && btnLoads.classList.contains('tbtn-editorial') && btnLoads.querySelector('.tbtn-text')
    && btnChaps && btnChaps.classList.contains('tbtn-editorial') && btnChaps.querySelector('.tbtn-text')));

// 4) Escape 键统一关闭全部 9 大核心弹窗/遮罩（含 Lightbox 分层优先关闭）
win.__resetS();
const escState = win.__getS();
escState.flags.named = 1;
escState.phase = 'academy';
escState.ageY = 13;
escState.freeRoam = true;
win.__setS(escState);
win.show('title-screen', 0);
win.show('game-screen', 1);

const escCases = [
  { id: 'vn-backlog-modal', open: () => VN.openBacklogModal() },
  { id: 'vn-saveload-modal', open: () => VN.openSaveLoadModal('load') },
  { id: 'vn-chapters-modal', open: () => VN.openChaptersModal() },
  { id: 'vn-prefs-modal', open: () => VN.openPrefsModal() },
  { id: 'rumor-overlay', open: () => RE.openRumorBoard() },
  { id: 'panel', open: () => win.openPanel('status') },
  { id: 'codex', open: () => VN.openCodexGallery('cg') },
  { id: 'stats-overlay', open: () => win.show('stats-overlay', 1) },
  { id: 'sys-popup', open: () => win.sysPopup('系统检测', '按 Escape 键即可收起') },
];
const escFailed = [];
for (const c of escCases) {
  c.open();
  const opened = vis(c.id);
  pressEscape();
  const closed = !vis(c.id);
  if (!opened || !closed) escFailed.push(`${c.id}(opened=${opened},closed=${closed})`);
}
ok('Escape 快捷键精准关闭 9 大弹窗 (#vn-backlog/saveload/chapters/prefs, #rumor-overlay, #panel, #codex, #stats-overlay, #sys-popup)',
  escFailed.length === 0, escFailed.join('; '));

// 5) M5 Auto / Skip (未读刹车!) / 打字机速度 / BGM & SFX 独立音量持久化
VN.resetPrefs();
VN.setPref('typeSpeed', 'instant');
const speedInstant = win.getTypeSpeed();
VN.setPref('typeSpeed', 'fast');
const speedFast = win.getTypeSpeed();

VN.setPref('bgmVol', 0.32);
VN.setPref('sfxVol', 0.84);
const bgm1 = win.bgmGetVolume();
const sfx1 = win.sfxGetVolume();
VN.setPref('sfxVol', 0.21);
const bgm2 = win.bgmGetVolume();
const sfx2 = win.sfxGetVolume();
const storedPrefs = JSON.parse(win.localStorage.getItem(VN.VN_PREFS_KEY) || '{}');

ok('打字机速度实时同步至 game.js (instant/fast) 且写入 localStorage 持久化',
  speedInstant === 'instant' && speedFast === 'fast' && storedPrefs.typeSpeed === 'fast',
  `instant=${speedInstant}, fast=${speedFast}, stored=${storedPrefs.typeSpeed}`);
ok('BGM 与 SFX 独立音量调节互不串扰且持久化至引擎与 localStorage',
  Math.abs(bgm1 - 0.32) < 0.005 && Math.abs(sfx1 - 0.84) < 0.005
  && Math.abs(bgm2 - 0.32) < 0.005 && Math.abs(sfx2 - 0.21) < 0.005
  && Math.abs(storedPrefs.bgmVol - 0.32) < 0.005 && Math.abs(storedPrefs.sfxVol - 0.21) < 0.005,
  `bgm=${bgm1}->${bgm2}, sfx=${sfx1}->${sfx2}`);

// Auto / Skip 互斥 + 未读台词强制刹车校验
win.__getS().freeRoam = false;
win.eval("currentScene = 's_guard_readtest'; awaitingChoice = false;");
const tb = $('text-box');
if (tb) tb.classList.remove('dialog-hidden', 'season-flavor');

VN.setAutoMode(true);
const autoOn = VN.isAutoMode() && $('btn-vn-auto') && $('btn-vn-auto').classList.contains('active');
const unreadText = '这是一句从未读过的全新守卫台词_' + Date.now();
VN.recordLine('希尔维亚', unreadText);
const skipBlockedOnUnread = VN.setSkipMode(true) === false && VN.isSkipMode() === false;
const brakeToastTxt = ($('toast') && $('toast').textContent) || '';

const readText = '这是一句已经读过的旧台词_' + Date.now();
VN.markLineRead('s_guard_readtest', readText);
const readCheck = VN.isLineRead('s_guard_readtest', readText) === true;
VN.recordLine('希尔维亚', readText);
const skipActiveOnRead = VN.setSkipMode(true) === true && VN.isSkipMode() === true && VN.isAutoMode() === false;
// 推进到下一句未读台词时应自动刹车停止 Skip
VN.recordLine('旁白', '紧接其后的全新未读章节台词_' + Date.now());
const autoBrakeOnNextUnread = VN.isSkipMode() === false;
VN.setAutoMode(false);
VN.setSkipMode(false);
VN.resetPrefs();

ok('M5 Auto / Skip 互斥运行，且 Skip 遇未读台词严格触发「已读快进·未读刹车」',
  autoOn && skipBlockedOnUnread && brakeToastTxt.includes('未读台词') && readCheck && skipActiveOnRead && autoBrakeOnNextUnread,
  `autoOn=${autoOn}, blocked=${skipBlockedOnUnread}, read=${readCheck}, activeOnRead=${skipActiveOnRead}, brake=${autoBrakeOnNextUnread}`);

// 6) M5 四合一「典藏图鉴馆」(CG 画廊 + BGM 音乐室 + 成就墙 + 信物手札 + #cg-lightbox)
win.localStorage.removeItem('ojousama_unlocked_cgs_v1');
win.localStorage.removeItem('ojousama_unlocked_chapters_v1');
win.__resetS();
const codexS = win.__getS();
codexS.flags = { named: 1 };
codexS.ach = {};
codexS.inv = [];
win.__setS(codexS);

VN.openCodexGallery('cg');
const tabBtns = doc.querySelectorAll('#codex-tabs [data-codex-tab]');
const lockedCgCards = doc.querySelectorAll('#codex-list .codex-cg-card.locked');
const hasEncryptedSilhouette = lockedCgCards.length === VN.CG_GALLERY_CATALOG.length
  && ($('codex-list').textContent || '').includes('未启封剪影');

const firstCg = VN.CG_GALLERY_CATALOG[0];
VN.markCgUnlocked(firstCg.unlockKey);
VN.openCodexGallery('cg');
const openCgBtn = doc.querySelector(`#codex-list [data-cg-open="${firstCg.id}"]`);
if (openCgBtn) openCgBtn.click();
const lightboxOpened = vis('cg-lightbox') && !!doc.querySelector('#cg-lightbox #cg-lb-img');
// 分层 Esc：先关 lightbox，底层 #codex 保持打开；再按 Esc 才关 #codex
pressEscape();
const lightboxClosedCodexStayed = !vis('cg-lightbox') && vis('codex');
pressEscape();
const codexClosedSecondEsc = !vis('codex');

VN.openCodexGallery('bgm');
const bgmRows = doc.querySelectorAll('#codex-list .bgm-track-row');
const firstPlayBtn = doc.querySelector('#codex-list [data-bgm-key]');
if (firstPlayBtn) firstPlayBtn.click();
const bgmNowTitle = ($('bgm-now-title') && $('bgm-now-title').textContent) || '';
const bgmStopBtn = $('bgm-room-stop');
const bgmAuditionWorks = bgmRows.length >= 10 && bgmNowTitle && !bgmNowTitle.includes('未在试听') && bgmStopBtn && !bgmStopBtn.disabled;
if (bgmStopBtn) bgmStopBtn.click();

VN.openCodexGallery('ach');
const achCards = doc.querySelectorAll('#codex-list .ach-card');
const hasAchProgress = !!doc.querySelector('#codex-list .ach-progress-bar') && achCards.length >= 5;

VN.openCodexGallery('memento');
const lockedMemCount = doc.querySelectorAll('#codex-list .memento-card.locked').length;
codexS.inv.push({ id: 'aino_handkerchief', name: '雪花纹手帕' });
VN.openCodexGallery('memento');
const openMemBtn = doc.querySelector('#codex-list [data-memento-open]');
if (openMemBtn) openMemBtn.click();
const mementoExpanded = !!doc.querySelector('#codex-list .memento-stationery');
pressEscape();

ok('M5 四合一典藏图鉴馆完整渲染 CG 加密剪影与全屏 #cg-lightbox（含分层 Esc 关闭）',
  tabBtns.length === 4 && hasEncryptedSilhouette && lightboxOpened && lightboxClosedCodexStayed && codexClosedSecondEsc,
  `tabs=${tabBtns.length}, silhouette=${hasEncryptedSilhouette}, lb=${lightboxOpened}, layered=${lightboxClosedCodexStayed}/${codexClosedSecondEsc}`);
ok('M5 典藏图鉴馆 BGM 音乐室试听、成就墙进度与信物手札展阅全链路正常',
  bgmAuditionWorks && hasAchProgress && lockedMemCount >= 1 && mementoExpanded,
  `bgm=${bgmAuditionWorks}, ach=${hasAchProgress}, lockedMem=${lockedMemCount}, expanded=${mementoExpanded}`);

// 7) M3.1 PORTRAIT_DIFF_PROTOCOL 完整性与缺失差分优雅降级至 _normal
const proto = win.PORTRAIT_DIFF_PROTOCOL || {};
const expectedDiffKeys = [
  'lein_normal', 'peilin_normal',
  'aino_serious', 'aino_smile', 'aino_shy',
  'jilan_serious', 'jilan_shy', 'jilan_teary',
  'charlotte_shy', 'charlotte_smile', 'noelle_smile',
];
ok('PORTRAIT_DIFF_PROTOCOL 完整登记 lein/peilin 与全部 9 张表情差分协议',
  expectedDiffKeys.every((k) => typeof proto[k] === 'string' && proto[k].endsWith('.png')),
  'keys=' + Object.keys(proto).join(','));

win.FAILED_PORTRAIT_URLS.clear();
win.show('game-screen', 1);
win.applyLineEffects({ portraits: [{ id: 'aino', slot: 'center', emo: 'serious', active: true }] });
const ainoSlot = doc.querySelector('.p-slot[data-char="aino"]');
const ainoImg = ainoSlot && ainoSlot.querySelector('img');
const initialSrc = ainoImg ? ainoImg.getAttribute('src') : '';
if (ainoImg && typeof ainoImg.onerror === 'function') ainoImg.onerror();
const fallbackSrc = ainoImg ? ainoImg.getAttribute('src') : '';
const resolvedAfterFail = win.resolvePortrait('aino', 'serious');
ok('M3.1 缺失表情差分触发 onerror 后优雅回落至 _normal 且记忆失败 URL（无崩溃无破图）',
  initialSrc === 'assets/portraits/aino_serious.png'
  && fallbackSrc === 'assets/portraits/aino_normal.png'
  && !ainoSlot.classList.contains('hidden')
  && win.FAILED_PORTRAIT_URLS.has('assets/portraits/aino_serious.png')
  && resolvedAfterFail === 'assets/portraits/aino_normal.png',
  `init=${initialSrc}, fb=${fallbackSrc}, next=${resolvedAfterFail}`);

// 8) EXITS.jikan 热点避开人物面部且全部 y <= 66
const jikanExits = (win.__EXITS && win.__EXITS.jikan) || [];
const jikanClean = jikanExits.length >= 2 && jikanExits.every((ex) =>
  typeof ex.y === 'number' && ex.y <= 66 && (ex.x <= 20 || ex.x >= 80)
);
ok('EXITS.jikan 场景出口热点全部避开立绘面部居中区且满足 y <= 66',
  jikanClean, JSON.stringify(jikanExits));

const realErrors = errors.filter((e) => !/HTMLMediaElement|play\(\)/.test(e));
ok('全程无未捕获 JS/DOM 运行时异常', realErrors.length === 0, realErrors.join(' | '));

console.log(`\n通过: ${pass} | 失败: ${fail}`);
process.exit(fail ? 1 : 0);
