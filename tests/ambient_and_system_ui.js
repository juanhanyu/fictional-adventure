'use strict';
/**
 * M2.1 / M2.3 氛围影院粒子层、冰晶宫殿推演盘与羊皮书志视觉体系守卫
 */
const fs = require('node:fs');
const path = require('node:path');
const { win, errors } = require('./harness');

const ROOT = path.resolve(__dirname, '..');
const doc = win.document;
const $ = (id) => doc.getElementById(id);
const AFX = win.AmbientFX;

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (cond) pass++;
  else fail++;
}

console.log('\n===== M2.1 / M2.3 氛围粒子层、冰晶宫殿推演盘与羊皮书志样式守卫 =====');

ok('window.AmbientFX 模块就绪并注入 #ambient-fx-canvas 画布',
  !!(AFX && $('ambient-fx-canvas') && $('ambient-fx-canvas').tagName === 'CANVAS'));

// 1) 背景类名自动映射氛围粒子模式 (snow / firefly / ember / dust / none)
const mSnow = AFX.resolveMode('bg-img-ice-canyon bg-snow');
const mDust = AFX.resolveMode('bg-img-jikan bg-hall');
const mNone = AFX.resolveMode('bg-void');
const mSetEmber = AFX.setMode('ember');
const mGetEmber = AFX.getMode();
ok('AmbientFX.resolveMode / setMode 正确映射并切换雪/浮尘/余烬/静默模式',
  mSnow === 'snow' && mDust === 'dust' && mNone === 'none' && mSetEmber === 'ember' && mGetEmber === 'ember',
  `snow=${mSnow}, dust=${mDust}, none=${mNone}, ember=${mGetEmber}`);

// 2) 特效开关持久化与 VNUx 偏好联动
AFX.setEnabled(false);
const offOk = AFX.isEnabled() === false && $('ambient-fx-canvas').classList.contains('afx-hidden');
AFX.setEnabled(true);
const onOk = AFX.isEnabled() === true && !$('ambient-fx-canvas').classList.contains('afx-hidden');
ok('AmbientFX.setEnabled 正确切换画布可见状态与持久化存储', offOk && onOk);

// 3) 冰晶宫殿滤镜 (body.ice-palace-lens) 与霜刃弧斩瞬态特效 (.afx-frost-slash)
AFX.triggerIcePalaceFilter(true);
const lensOn = doc.body.classList.contains('ice-palace-lens');
AFX.triggerIcePalaceFilter(false);
const lensOff = !doc.body.classList.contains('ice-palace-lens');
const slashEl = AFX.triggerFrostSlash({ reverse: true });
const slashOk = !!(slashEl && slashEl.classList.contains('afx-frost-slash')
  && slashEl.classList.contains('is-reversed') && slashEl.querySelector('svg'));
if (slashEl && slashEl.parentNode) slashEl.parentNode.removeChild(slashEl);
ok('冰晶宫殿视界滤镜 (ice-palace-lens) 与霜刃弧斩 SVG 瞬态特效正常挂载与回收',
  lensOn && lensOff && slashOk);

// 4) 交互式「冰晶宫殿·寒夜推演盘」全流程：锁定确认 -> 选中全部关键证物 -> 凝结确认 -> 清理滤镜 + Escape 略过
let resolvePayload = null;
AFX.openDeductionBoard({
  title: '白昼里的夜 · 证物映照',
  requiredIds: ['boots', 'moon_shadow'],
  clues: [
    { id: 'boots', label: '洁净靴底', detail: '雨夜林道泥泞，靴底却一尘不染。', isKey: true },
    { id: 'decoy', label: '酒馆传闻', detail: '街坊私下议论邪物作祟。', isKey: false },
    { id: 'moon_shadow', label: '月影迟滞', detail: '日蚀时唯有罗文的影痕慢了半息。', isKey: true },
  ],
  conclusion: '真凶移尸设局并借晦轮杖遮日。',
}, (res) => { resolvePayload = res; });

const openOk = AFX.isDeductionOpen() && !$('ice-deduction-modal').classList.contains('hidden')
  && doc.body.classList.contains('ice-palace-lens');
const confirmBtn = $('idb-confirm-btn');
const initiallyDisabled = !!(confirmBtn && confirmBtn.disabled);
doc.querySelector('[data-clue-id="boots"]').click();
const stillDisabledAfterOne = !!(confirmBtn && confirmBtn.disabled);
doc.querySelector('[data-clue-id="moon_shadow"]').click();
const enabledAfterAllKeys = !!(confirmBtn && !confirmBtn.disabled)
  && !$('idb-conclusion-block').classList.contains('hidden');
confirmBtn.click();
const closedCleanly = !AFX.isDeductionOpen() && $('ice-deduction-modal').classList.contains('hidden')
  && !doc.body.classList.contains('ice-palace-lens');

ok('冰晶宫殿推演盘按关键证物解锁结论，确认后回调 resolved:true 并退去滤镜',
  openOk && initiallyDisabled && stillDisabledAfterOne && enabledAfterAllKeys && closedCleanly
  && resolvePayload && resolvePayload.resolved === true && resolvePayload.skipped === false
  && resolvePayload.selectedIds.includes('boots') && resolvePayload.selectedIds.includes('moon_shadow'));

let skipPayload = null;
AFX.openDeductionBoard({
  clues: [{ id: 'c1', label: '证物甲', detail: '细节', isKey: true }],
}, (res) => { skipPayload = res; });
$('idb-skip-btn').click();
const skipClean = !AFX.isDeductionOpen() && $('ice-deduction-modal').classList.contains('hidden')
  && !doc.body.classList.contains('ice-palace-lens')
  && skipPayload && skipPayload.skipped === true && skipPayload.resolved === false;

let closeXPayload = null;
AFX.openDeductionBoard({
  clues: [{ id: 'c2', label: '证物乙', detail: '细节', isKey: true }],
}, (res) => { closeXPayload = res; });
$('idb-close-x').click();
const closeXClean = !AFX.isDeductionOpen() && $('ice-deduction-modal').classList.contains('hidden')
  && closeXPayload && closeXPayload.skipped === true;

ok('推演盘点击「略过推演」(#idb-skip-btn) 或关闭按钮 (#idb-close-x) 均安全略过并退去滤镜',
  skipClean && closeXClean);

// 5) CSS 视觉体系静态守卫 (system-chronicle.css & ambient-fx.css 关键令牌与类完备)
const sysCss = fs.readFileSync(path.join(ROOT, 'css/system-chronicle.css'), 'utf8');
const afxCss = fs.readFileSync(path.join(ROOT, 'css/ambient-fx.css'), 'utf8');
ok('css/system-chronicle.css 与 css/ambient-fx.css 关键主题令牌与图层规则完备',
  sysCss.includes('--vellum-top') && sysCss.includes('--prussian') && sysCss.includes('.tbtn-editorial')
  && afxCss.includes('#ambient-fx-canvas') && afxCss.includes('body.ice-palace-lens') && afxCss.includes('.afx-frost-slash'));

const realErrors = errors.filter((e) => !/HTMLMediaElement|play\(\)/.test(e));
ok('全程无未捕获 JS/DOM 运行时异常', realErrors.length === 0, realErrors.join(' | '));

console.log(`\n通过: ${pass} | 失败: ${fail}`);
process.exit(fail ? 1 : 0);
