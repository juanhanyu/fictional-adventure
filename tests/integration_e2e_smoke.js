'use strict';
// 三路合流端到端联动冒烟验收：
// 在同一真实 DOM 实例中验证：第三卷剧情(B) + 策略智斗引擎(C1) + 双层因果暗流与AI交谈面板(C2) 无损共存、零全局冲突、零运行时报错，
// 同时验证 tavern-prompt.mjs 去重与 tools/novel_linter.py 角色台词调用栈修复。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const h = require('./harness.js');

const ROOT = path.resolve(__dirname, '..');
const win = h.win;
const doc = win.document;
const $ = (id) => doc.getElementById(id);

let sd = 0;
win.setTimeout = (fn) => { if (++sd > 160000) { sd--; return 0; } try { fn(); } finally { sd--; } return 0; };
win.setInterval = () => 0;
win.clearInterval = () => 0;
win.clearTimeout = () => 0;
win.__setTypingDrain();

const vis = (id) => { const el = $(id); return !!(el && !el.classList.contains('hidden')); };

let fail = 0;
function ok(label, cond, detail) {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${!cond && detail ? ' -> ' + detail : ''}`);
  if (!cond) fail++;
}

function driveUntilFree(maxSteps = 20000) {
  for (let i = 0; i < maxSteps; i++) {
    if (vis('cg-screen')) { const c = $('cg-screen'); if (typeof c.onclick === 'function') { c.onclick(); continue; } }
    if (vis('card')) { const c = $('card'); if (typeof c.onclick === 'function') { c.onclick(); continue; } }
    if (vis('pick-screen')) {
      const card = doc.querySelector('#pick-grid .pick-card:not(.disabled)');
      if (card && typeof card.onclick === 'function') { card.onclick(); continue; }
    }
    if (vis('battle-screen')) {
      const doneBtn = $('cr-done');
      if (doneBtn) { doneBtn.click(); continue; }
      const skBtn = doc.querySelector('#b-actions .cb-skill-card:not(:disabled), #b-actions .choice:not(:disabled)');
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

(async () => {
  console.log('\n===== 三路合流端到端联动冒烟验收 (B + C1 + C2) =====');

  // 1) index.html 资源加载顺序与零重复校验
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const expectedCss = ['style.css', 'css/combat.css', 'css/ai-branching.css'];
  const expectedJs = [
    'js/story.js',
    'js/story-vol3.js',
    'js/ai-personas.js',
    'game.js',
    'js/branching-director.js',
    'js/combat-engine.js',
    'js/ai-chat-panel.js',
    'js/tavern-bridge.js',
  ];
  const cssPositions = expectedCss.map((f) => indexHtml.indexOf(`href="${f}"`));
  const jsPositions = expectedJs.map((f) => indexHtml.indexOf(`src="${f}"`));
  const cssOrdered = cssPositions.every((p, idx) => p >= 0 && (idx === 0 || p > cssPositions[idx - 1]));
  const jsOrdered = jsPositions.every((p, idx) => p >= 0 && (idx === 0 || p > jsPositions[idx - 1]));
  const noDupScripts = expectedJs.every((f) => indexHtml.split(`src="${f}"`).length === 2);
  ok('index.html 按正确依赖顺序引入全部 CSS (style -> combat -> ai-branching)', cssOrdered);
  ok('index.html 按正确依赖顺序引入全部 8 份 JS 且零重复绑定', jsOrdered && noDupScripts);

  // 过滤掉 jsdom 未实现 HTMLMediaElement.play() 的固定无害提示
  const realBootErrors = h.errors.filter((e) => !/HTMLMediaElement|play\(\)/.test(e));
  ok('同一 DOM 实例加载全部三路脚本零运行时报错', realBootErrors.length === 0, realBootErrors.join(' | '));
  ok('三大核心全局模块同时就绪 (第三卷原著剧本 + 间章 + CombatEngine + BranchingDirector + AIChatPanel + AI_PERSONAS，且无草稿章)',
    !!(win.SCENES && win.SCENES.s_north_forest && win.SCENES.s_distant_wind_1 && win.SCENES.s_interlude_white_night
      && !win.SCENES.s_distant_wind_2 && !win.SCENES.s_vol4_frost_watch && !win.SCENES.s_vol4_wind_echo
      && win.CombatEngine && win.BranchingDirector && win.AIChatPanel && win.AI_PERSONAS));

  // 2) HUD 按钮共存检查（战斗演武 + 命运暗流 + AI交谈 + 面板）
  const hudBtns = ['btn-arena', 'btn-causal-quick', 'btn-ai-drawer', 'btn-panel', 'btn-stats'];
  ok('HUD 右侧功能按钮完整共存无缺失无覆盖', hudBtns.every((id) => !!$(id)));

  // 3) 同一 DOM 实例串行联动：第三卷剧情 + 新战斗引擎实战 + 战后复盘/演武大厅 + 因果面板 + AI抽屉
  win.__resetS();
  win.show('title-screen', 0);
  win.show('game-screen', 1);
  win.__drain.length = 0;

  let sawCombatUI = false;
  win.__runScene('s_north_forest');
  for (let i = 0; i < 12000; i++) {
    if (vis('battle-screen')) {
      sawCombatUI = !!doc.querySelector('#b-actions .cb-skill-card');
      break;
    }
    if (vis('card')) { const c = $('card'); if (typeof c.onclick === 'function') { c.onclick(); continue; } }
    const chBox = $('choices');
    if ((win.__getAwaiting() || (chBox && chBox.children.length)) && chBox) {
      const cbtn = chBox.querySelector('.choice:not(:disabled)');
      if (cbtn && typeof cbtn.onclick === 'function') { cbtn.onclick(); continue; }
    }
    if (win.__drain.length) { win.__drain.shift()(); continue; }
    break;
  }
  ok('第三卷 s_north_forest 实战遭遇战无缝接入新战斗引擎 UI (.cb-skill-card)', sawCombatUI);

  // 打完北林实战并走通 s_distant_wind_1 进入赫兰冰封峡谷自由探索
  driveUntilFree();
  win.__runScene('s_distant_wind_1');
  driveUntilFree();
  const s = win.__getS();
  ok('第三卷远行主线走通：进入 freeRoam、解锁 ice_canyon、保留眷寒渔伪装与乌木铁剑',
    s.freeRoam === true && win.__LOCS.ice_canyon.unlock === true && s.alias === '眷寒渔' && s.inv.some((it) => it.id === 'ebony_sword'));

  // 在同一实例中打开战术演武沙盒 -> 开一局北境协防战 -> 撤出返回
  $('btn-arena').click();
  ok('点击 HUD ⚔️ 打开战术演武大厅 (#arena-overlay 可见)', vis('arena-overlay'));
  win.CombatEngine.startStage('hulan_beast_tide', { fromArena: true, usePreset: true });
  ok('演武大厅启动「北境协防·冰封峡谷」关卡成功进入战斗且具备冰晶宫殿与魔战倾注面板',
    vis('battle-screen') && !!$('cb-btn-palace') && !!$('cb-oc-seg'));
  win.CombatEngine.exitBattle(false);
  win.CombatEngine.closeArenaHub();
  ok('退出战斗与演武大厅后无缝恢复自由探索，且第三卷存档状态零破坏',
    !vis('battle-screen') && !vis('arena-overlay') && Boolean(win.__getS().flags.ch_distant_wind_1));

  // 在同一实例中切到冰封峡谷并触发 AI 交谈抽屉与因果暗流演化
  win.enterLoc('ice_canyon');
  win.AIChatPanel.openDrawer('aino');
  ok('在第三卷冰封峡谷自由探索中打开 AI 交谈抽屉 (#ai-drawer 可见且可选艾诺)', vis('ai-drawer'));

  const applied = win.BranchingDirector.applyAIOutcome('aino', {
    emotion: 'smile',
    causal_deltas: { axis: 'kinship', delta: 1, clue: 'polar_lily_bond' },
    memory_echo: '冰封峡谷风口并肩守夜的约定'
  });
  ok('AI 交谈结果实时写入 S.causal 命运暗流与回声池，且不干扰战斗/剧情状态',
    !!(applied && applied.applied && win.__getS().causal.axes.aino.kinship >= 1 && win.__getS().causal.clues.polar_lily_bond));
  win.AIChatPanel.closeDrawer();

  // 打开综合面板，校验命运暗流 + 技能(合并B与C1) + 成就(合并B与C1)
  win.openPanel('causal');
  const causalHtml = $('panel-body').innerHTML;
  ok('综合面板「🌊 命运暗流」页签正常渲染五组双轴与线索', causalHtml.includes('爱丽丝') && causalHtml.includes('艾诺'));

  win.addSkill('instant_ice');
  win.openPanel('skills');
  const skillsHtml = $('panel-body').innerHTML;
  ok('综合面板「技能」页签同时显示第三卷技能「隔空凝冰」与战术演武入口按钮',
    skillsHtml.includes('隔空凝冰') && !!$('btn-panel-arena'));
  win.show('panel', 0);

  // 验证 SAFE_FLAG_KEYS 已覆盖第三卷 flags
  const safeFlags = win.AI_PERSONAS.extractSafeFlags(win.__getS().flags);
  ok('AI_PERSONAS.extractSafeFlags 已透传第三卷 ch_distant_wind_1 进度标记', safeFlags.ch_distant_wind_1 === true);

  // 4) 微瑕修复验证 ①：tavern-prompt.mjs 中 TAVERN_FOOTER_SPEC 严格去重（仅出现 1 次）
  const tavernPrompt = await import('../tavern-prompt.mjs');
  const footerMarker = '【舞台联动尾注格式（必附）】';
  const countInConst = tavernPrompt.SYSTEM_PROMPT.split(footerMarker).length - 1;
  const builtSysPrompt = tavernPrompt.buildSystemPrompt({
    playing: true,
    scene: 's_distant_wind_1',
    location: '冰封峡谷',
    phase: 'journey',
    player: { name: '眷寒渔', age: 16, year: 16, month: 12, day: 1 },
    people: [{ id: 'aino', name: '艾诺·塔尔维', short: '艾诺', role: '前线指挥' }],
    flags: safeFlags,
    causal: win.BranchingDirector.getCausalSnapshot(win.__getS()),
  }, 'aino');
  const countInBuilt = builtSysPrompt.split(footerMarker).length - 1;
  ok('tavern-prompt.mjs 中 TAVERN_FOOTER_SPEC 严格去重（SYSTEM_PROMPT=1次，buildSystemPrompt=1次）',
    countInConst === 1 && countInBuilt === 1, `const=${countInConst}, built=${countInBuilt}`);

  // 5) 微瑕修复验证 ②：tools/novel_linter.py 角色台词调用栈检查（SAY 识别 + 嵌套旁白不误豁免）
  const tmpJs = path.join(os.tmpdir(), `fa_linter_stack_${Date.now()}.js`);
  fs.writeFileSync(tmpJs, [
    "const SCENES = { s_test: { lines: [",
    "  SAY('aino', '艾诺', 'normal', '我才不是特意等你的。'),",
    "  DUO(['sylvia', '渔'], ['alice', '爱丽丝'], 'alice', '才不是这样。', {",
    "    choices: [{ text: '继续前行', lines: [T('她心里明白那不是巧合，而是蓄谋。')] }]",
    "  }),",
    "] } };",
  ].join('\n'), 'utf8');
  let lintStackOk = false;
  let lintDetail = '';
  try {
    const pyBin = process.platform === 'win32' ? 'python' : 'python3';
    const lr = spawnSync(pyBin, [path.join(ROOT, 'tools', 'novel_linter.py'), '--strict', tmpJs], { encoding: 'utf8' });
    const parsed = JSON.parse(lr.stdout || '{}');
    const issues = parsed.issues || [];
    // 期望：SAY 中的 '艾诺' 被跳过、SAY/DUO 口语台词里的单独「才不是」合法放行；
    // 而嵌套在 DUO extra.choices.lines 内的 T('她心里明白那不是巧合，而是蓄谋。') 被准确检出 1 条 no_bushi 错误！
    lintStackOk = lr.status === 1 && issues.length === 1 && issues[0].rule === 'no_bushi' && issues[0].line === 4;
    lintDetail = `exit=${lr.status}, issues=${JSON.stringify(issues)}`;
  } finally {
    try { fs.unlinkSync(tmpJs); } catch (e) {}
  }
  ok('tools/novel_linter.py 角色台词调用栈精确识别 SAY/DUO 豁免且不漏检嵌套 T() 旁白', lintStackOk, lintDetail);

  // 6) 第2轮跨分支深度回归验证（6 组硬伤根治断言）
  // 6.1) 全局键盘穿透隔离 & Esc 关闭 AI 抽屉
  win.show('title-screen', 0);
  win.show('game-screen', 1);
  win.show('panel', 0);
  win.show('map-overlay', 0);
  win.__getS().freeRoam = true;
  win.AIChatPanel.openDrawer('aino');
  const cfgBox = doc.getElementById('aid-cfg-box');
  if (cfgBox) cfgBox.classList.remove('hidden');
  const proxyInput = doc.getElementById('aid-proxy');
  proxyInput.focus();
  proxyInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true }));
  const panelOpenedOnP = vis('panel');
  proxyInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true }));
  const mapOpenedOnM = vis('map-overlay');
  proxyInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  proxyInput.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  ok('在 #aid-proxy 输入 p/m/Space 绝不穿透弹出状态面板或地图，按 Escape 优雅关闭 AI 抽屉',
    !panelOpenedOnP && !mapOpenedOnM && !vis('ai-drawer'),
    `panelOpenedOnP=${panelOpenedOnP}, mapOpenedOnM=${mapOpenedOnM}, drawerVis=${vis('ai-drawer')}`);

  // 6.2) 点击 🏠 返回标题页：同时关闭 AI 抽屉并静默清理活跃战斗
  win.AIChatPanel.openDrawer('aino');
  win.CombatEngine.startStage('hulan_beast_tide', { fromArena: false, usePreset: true });
  $('btn-title').click();
  ok('点击 btn-title 返回标题页彻底关闭 AI 抽屉并清理活跃战斗状态',
    vis('title-screen') && !vis('game-screen') && !vis('ai-drawer') && !vis('battle-screen') && !vis('arena-overlay') && win.CombatEngine.getState() === null);

  // 6.3) 第三卷 AI 灵魂卡身份锁（玛莎/穆萨等伪装期 NPC）+ 冰封峡谷前线艾诺档位与保密锁
  const mashaSnap = {
    playing: true,
    scene: 'free-roam',
    location: '澄岚公会',
    phase: 'journey',
    player: { name: '眷寒渔', age: 15, year: 16, month: 3, day: 1 },
    people: [{ id: 'masha', name: '玛莎', short: '玛莎', role: '公会接待' }],
    flags: { named: true, arrived_jikan: true, ch_black_name: true },
  };
  const mashaGate = win.AI_PERSONAS.getTemporalGate('masha', mashaSnap);
  const mashaPrompt = win.AI_PERSONAS.buildPersonaSystemPrompt('masha', mashaSnap);
  const mashaLeaksDuke = /维斯特利亚公爵家次女|银灰色长发|蓝色眼眸/.test(mashaGate.knownPlayerIdentity + '\n' + mashaPrompt);
  ok('澄岚公会玛莎 AI 灵魂卡严格锁死黑发墨绿眼「眷寒渔」伪装身份，零剧透公爵千金或银发蓝眸',
    !mashaLeaksDuke && mashaGate.knownPlayerIdentity.includes('黑发') && mashaGate.knownPlayerIdentity.includes('眷寒渔'),
    mashaGate.knownPlayerIdentity);

  const ainoFrontSnap = {
    playing: true,
    scene: 'free-roam',
    location: '冰封峡谷',
    phase: 'journey',
    player: { name: '眷寒渔', age: 16, year: 16, month: 12, day: 1 },
    people: [{ id: 'aino', name: '艾诺·塔尔维', short: '艾诺', role: '前线指挥' }],
    flags: { named: true, met_aino: true, ch_ice_melt_1: true, ch_distant_wind_1: true },
  };
  const ainoFrontStage = win.AI_PERSONAS.resolvePersonaStage('aino', ainoFrontSnap);
  const ainoFrontGate = win.AI_PERSONAS.getTemporalGate('aino', ainoFrontSnap);
  const ainoFrontPrompt = win.AI_PERSONAS.buildPersonaSystemPrompt('aino', ainoFrontSnap);
  const ainoFrontHasStage = ainoFrontStage.stageLabel.includes('冰封峡谷') && ainoFrontPrompt.includes('左下角') && ainoFrontPrompt.includes('魔剑士');
  const ainoFrontLeaksSilver = /银灰色长发|银发蓝眸|蓝色眼眸|维斯特利亚公爵家次女/.test(ainoFrontGate.knownPlayerIdentity + '\n' + ainoFrontPrompt);
  ok('冰封峡谷前线艾诺 AI 灵魂卡具备「前线重逢期」保密档位（认出冰膜左下角却称魔剑士/渔且零泄露银发蓝眸）',
    ainoFrontHasStage && !ainoFrontLeaksSilver,
    `stage=${ainoFrontStage.stageLabel}, leaks=${ainoFrontLeaksSilver}`);

  // 6.4) B+C2 辞行合流、s_distant_wind_1 凯尔了解度修复、零双剑、零重复艾诺手帕 ID
  win.__resetS();
  win.show('title-screen', 0);
  win.show('game-screen', 1);
  const mergeS = win.__getS();
  mergeS.ageY = 15; mergeS.year = 16; mergeS.month = 6; mergeS.phase = 'journey'; mergeS.alias = '眷寒渔'; mergeS.loc = 'chenglan_guild';
  mergeS.flags = { named: 1, arrived_jikan: 1, ch_black_name: 1, ch_north_forest: 1, ch_glow_sheep: 1 };
  win.BranchingDirector.ensureCausalState(mergeS);
  mergeS.causal.clues.polar_lily_bond = true;
  mergeS.causal.clues.wind_god_echo = true;
  mergeS.causal.axes.jilan.wanderlust = 3;
  win.__setS(mergeS);
  win.__drain.length = 0;
  win.__runScene('s_distant_wind_1');
  driveUntilFree();
  const afterDw1 = win.__getS();
  const kyleKnowAfterDw1 = afterDw1.know.kyle || 0;
  const auroraKnowAfterDw1 = afterDw1.know.mage_aurora || 0;
  const swordCountAfterDw1 = afterDw1.inv.filter((x) => x && x.id === 'ebony_sword').length;
  const hasPassAfterDw1 = afterDw1.inv.some((x) => x && x.id === 'northwind_pass');
  afterDw1.loc = 'jikan';
  afterDw1.freeRoam = true;
  const jikanVignettesAfterDw1 = win.BranchingDirector.getAvailableVignettesHere(afterDw1).map((v) => v.id);
  ok('s_distant_wind_1 修复重复键后同时累加 kyle(+15) 与 mage_aurora(+10) 了解度',
    kyleKnowAfterDw1 >= 15 && auroraKnowAfterDw1 >= 10, `kyle=${kyleKnowAfterDw1}, aurora=${auroraKnowAfterDw1}`);
  ok('s_distant_wind_1 无损承接北风堡因果分歧（获北风堡木牌且仅 1 把乌木铁剑），回霁馆绝不重复亮起辞行/夜廊热点',
    swordCountAfterDw1 === 1 && hasPassAfterDw1 && afterDw1.causal.payoffsTriggered.northern_vow === true
    && !jikanVignettesAfterDw1.includes('s_jikan_north_vow') && !jikanVignettesAfterDw1.includes('v_jilan_night'),
    `swords=${swordCountAfterDw1}, pass=${hasPassAfterDw1}, jikanVignettes=${jikanVignettesAfterDw1.join(',')}`);

  // 反向路径：先走 s_jikan_north_vow 后置位 ch_distant_wind_1，16年6月门控不再重演，且 addItem 幂等去重
  win.__resetS();
  const nvFirst = win.__getS();
  nvFirst.ageY = 15; nvFirst.year = 16; nvFirst.month = 3; nvFirst.phase = 'journey'; nvFirst.alias = '眷寒渔'; nvFirst.loc = 'jikan';
  nvFirst.flags = { named: 1, arrived_jikan: 1, ch_black_name: 1, ch_north_forest: 1, ch_glow_sheep: 1 };
  win.BranchingDirector.ensureCausalState(nvFirst);
  nvFirst.causal.clues.polar_lily_bond = true;
  win.__setS(nvFirst);
  win.__drain.length = 0;
  win.__runScene('s_jikan_north_vow');
  driveUntilFree();
  ok('先触发 s_jikan_north_vow 后自动闭环 ch_distant_wind_1 且仅 1 把乌木铁剑',
    !!win.__getS().flags.ch_distant_wind_1 && win.__getS().inv.filter((x) => x.id === 'ebony_sword').length === 1);

  // 两块艾诺手帕 ID 完全解耦共存（学院 aino_academy_handkerchief vs 冰封峡谷 aino_handkerchief）
  win.__resetS();
  const hdkS = win.__getS();
  hdkS.flags = { named: 1, met_aino: 1 };
  win.addItem({ id: 'aino_academy_handkerchief', name: '雪纹手帕', icon: '❄️', desc: '学院窗台纪念' });
  win.addItem({ id: 'aino_handkerchief', name: '雪花纹手帕', icon: '❄️', desc: '冰封峡谷重逢' });
  win.addItem({ id: 'aino_handkerchief', name: '雪花纹手帕', icon: '❄️', desc: '重复入包幂等校验' });
  ok('两块艾诺手帕使用独立 ID 共存，且 addItem 对唯一道具幂等去重',
    hdkS.inv.filter((x) => x.id === 'aino_academy_handkerchief').length === 1
    && hdkS.inv.filter((x) => x.id === 'aino_handkerchief').length === 1);

  // 6.5) 探索实战热点时间线门控与地理位置校验
  win.__resetS();
  win.show('title-screen', 0);
  win.show('game-screen', 1);
  const hsState = win.__getS();
  hsState.freeRoam = true; hsState.ageY = 13; hsState.phase = 'academy'; hsState.loc = 'training_field';
  hsState.flags = { named: 1, met_aino: 1, ch_ice_melt_1: 1 };
  win.__setS(hsState);
  win.renderHotspots();
  const ainoSpotAfterLeave = ($('hotspots').textContent || '').includes('冰上实战·三击切磋');

  hsState.ageY = 15; hsState.phase = 'journey'; hsState.loc = 'road';
  hsState.flags = { named: 1, did_turnpoint: 1, ch_black_name: 1 };
  win.renderHotspots();
  const hulanSpotEarlyRoad = ($('hotspots').textContent || '').includes('北境协防·冰封峡谷');

  hsState.ageY = 16; hsState.phase = 'journey'; hsState.loc = 'ice_canyon';
  hsState.flags = { named: 1, did_turnpoint: 1, ch_black_name: 1, ch_distant_wind_1: 1 };
  win.__LOCS.ice_canyon.unlock = true;
  win.renderHotspots();
  const hulanSpotAtIceCanyon = ($('hotspots').textContent || '').includes('北境协防·冰封峡谷');
  ok('探索热点时间线严谨：艾诺离校后无幽灵切磋、早期官道无赫兰剧透、冰封峡谷正确挂载北境协防实战',
    !ainoSpotAfterLeave && !hulanSpotEarlyRoad && hulanSpotAtIceCanyon,
    `ainoAfterLeave=${ainoSpotAfterLeave}, earlyRoad=${hulanSpotEarlyRoad}, atIceCanyon=${hulanSpotAtIceCanyon}`);

  // 6.6) 第三卷课程技能 frost_edge（覆冰锋）与 instant_ice（隔空凝冰）真实联动 C1 战斗引擎
  win.__resetS();
  const baseC = win.__getS();
  baseC.ageY = 16; baseC.lv = 38; baseC.phase = 'journey'; baseC.alias = '眷寒渔'; baseC.atk = 30; baseC.mag = 55;
  baseC.skills = ['root_step', 'soft_cut'];
  win.__setS(baseC);
  const bWithout = win.CombatEngine.startStage('north_forest_hunt', { headless: true, usePreset: false });
  const swordSk = win.CombatEngine.SKILLS.sword_water_edge;
  const remoteSk = win.CombatEngine.SKILLS.remote_snap_spike;
  const dmgSwordBase = win.CombatEngine.estimateSkillDamage(bWithout, swordSk, bWithout.enemies[0]).dmg;
  const dmgRemoteBase = win.CombatEngine.estimateSkillDamage(bWithout, remoteSk, bWithout.enemies[0]).dmg;

  baseC.skills = ['root_step', 'soft_cut', 'frost_edge', 'instant_ice'];
  const bWith = win.CombatEngine.startStage('north_forest_hunt', { headless: false, usePreset: false });
  const dmgSwordBoost = win.CombatEngine.estimateSkillDamage(bWith, swordSk, bWith.enemies[0]).dmg;
  const dmgRemoteBoost = win.CombatEngine.estimateSkillDamage(bWith, remoteSk, bWith.enemies[0]).dmg;
  const buffHtml = ($('cb-p-buffs') && $('cb-p-buffs').innerHTML) || '';
  win.CombatEngine.exitBattle(false, { silent: true });
  ok('第三卷课程技能 frost_edge / instant_ice 真实接入 C1 战斗引擎并提升剑技与隔空瞬凝伤害、展示被动徽章',
    bWith.player.passives.includes('frost_edge')
    && bWith.player.passives.includes('instant_ice')
    && bWith.player.skills.includes('remote_snap_spike')
    && dmgSwordBoost > dmgSwordBase
    && dmgRemoteBoost > dmgRemoteBase
    && buffHtml.includes('覆冰锋') && buffHtml.includes('隔空凝冰'),
    `sword:${dmgSwordBase}->${dmgSwordBoost}, remote:${dmgRemoteBase}->${dmgRemoteBoost}`);

  // 7) 再次确认全过程无新增运行时 JS 异常
  const finalRealErrors = h.errors.filter((e) => !/HTMLMediaElement|play\(\)/.test(e));
  ok('端到端全链路联动操作结束后零运行时异常', finalRealErrors.length === 0, finalRealErrors.join(' | '));

  console.log(fail === 0 ? '  ✅ 三路合流端到端联动冒烟测试全绿！' : `  ✗ ${fail} 处失败`);
  process.exit(fail ? 1 : 0);
})();
