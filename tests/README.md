# 测试台（jsdom 冒烟排查）

`tests/` 是一个基于 **jsdom** 的离线测试台，可在无浏览器环境下加载 `index.html + js/story.js + game.js`
到同一个 window，对引擎与全部剧情数据做静态校验、运行时冒烟、门控集成与全时间线通关模拟。

## 运行

```bash
npm test        # 在 tests/ 目录执行：依次跑 validate / smoke / gate_flow / full_playthrough
# 或单个：
node tests/validate.js
node tests/smoke.js
node tests/gate_flow.js
node tests/full_playthrough.js
```

依赖仅 `jsdom`（`tests/node_modules/`，已由根目录 `.gitignore` 排除）。

## 测试说明

| 文件 | 作用 |
|------|------|
| `harness.js` | 加载器。将 story.js + game.js 拼成**一次 eval**共享作用域（等同浏览器同全局），
  注入最小 AudioContext 桩，并暴露 `__resetS / __runScene / __getS / __setTypingDrain` 等测试钩子。 |
| `validate.js` | **静态校验**：门控/runScene/goto 引用的场景是否存在、`bg` 类是否在 style.css 定义
  （缺 `bg-img-*` 且非抽象氛围类时报警）、`loc` 是否合法 LOCS、`ch`/立绘角色是否登记、`emo`/`slot` 是否合法、文本是否为空。 |
| `smoke.js` | **运行时冒烟**：同步桩逐场景跑 `playLines`，触发所有 `do:`/`if:` 闭包与效果副作用，捕捉崩溃。 |
| `gate_flow.js` | **门控集成**：模拟指定时间/flag 触发门控，用「逐行排空」异步驱动验证场景队列按序完整播放。 |
| `full_playthrough.js` | **全时间线通关模拟**：从出生起逐季度推进时间并触发门控，验证整部故事走通、无崩溃无卡死。 |

## 关键点

- 引擎顶层 `const/let/function` 位于 eval 作用域内，不会挂到 `window`；harness 用追加代码暴露所需钩子。
- 打字机/计时器需做同步化桩：`__setTypingSync()` 立即完成；`__setTypingDrain()` 把回调入队、由驱动逐行推进，
  以正确模拟真实异步时序（避免 `showCard` 的 `card.onclick=null` 在纯同步下清掉下一场景刚设置的卡片事件）。
- 抽象/纯氛围色调类（`bg-void / bg-night / bg-pick / bg-battle / bg-duel / bg-ending`）允许单独使用，不视为背景缺失。

## 本次修复（测试驱动发现并修掉的 Bug）

1. **断裂门控**：`s_academy_start`（第二卷序·离巢）、`s_noelle_meet`（初遇诺艾儿·水系课堂）被 `checkStoryGates`
   引用但未定义，导致 12岁春 学院篇开场与诺艾儿初遇被静默跳过。已按原著补写这两个场景。
2. **CSS 类名笔误**：`s_ice_melt_1/2` 使用 `bg-img-ice_classroom`（下划线），而 style.css 中正确类是
   `bg-img-ice-classroom`（连字符），导致冰系教室背景不显示。已全部更正。
3. **未登记角色**：`maid / teacher_middle / merchant_bakery / merchant_jewel / fengshen / jianshen / wanshen /
   shengnu / moshen` 等角色有立绘文件却在 `CHARS / PORTRAIT_FILES / CSS_CHARS` 未登记，导致场景中立绘回退为
   CSS 占位。已在三处补登记。
4. **纯色调背景缺图**：`s_yaoshen / s_charlotte_meet / s_aino_meet / s_aino_sparring / s_tree / s_jikan_arrive /
   s_first_word / s_alice_born / s_start(L34)` 等位置场景只用了色调类、未带对应 `bg-img-*`，按项目规则背景不显示，已补图。
