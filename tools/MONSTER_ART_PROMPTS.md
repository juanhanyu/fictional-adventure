# 《转生千金～到了异世界就要悠闲地生活》怪物 & Boss 美术立绘生产指南（Copy-Paste 完整提示词包）

> 本文档面向 **Midjourney (Niji 6 / v6) · SDXL / Illustrious / Animagine XL · Flux.1 · ComfyUI · NovelAI** 直接复制粘贴出图。  
> 全套立绘统一对齐本作 **明亮冰晶轻小说绘本风（Luminous Light-Novel Anime Illustration）**，与现有 `assets/portraits/` 角色立绘保持一致的细腻线稿、通透厚涂赛璐璐光影与纯透明抠图剪影。

---

## 一、快速接入与规格说明（Quick Drop-In Guide）

### 1. 文件存放与出图规范
- **保存目录**：将导出后的透明背景 PNG 放入 `assets/monsters/<filename>.png`（目录不存在时直接新建即可）。
- **图片格式**：**32-bit RGBA 透明底 PNG**（`alpha` 通道干净，边缘无白边/灰边、无伪透明棋盘格）。
- **强制朝向**：**统一面朝左侧（Facing LEFT）**——战斗舞台中希尔维亚位于左侧，敌方位于右侧，面向左方即可自然形成对峙构图；若生成结果面朝右侧，请在抠图后水平镜像（注意检查持武器手势与纹章对称）。
- **构图留白**：人物/魔物完整入画，四周预留 **5%–8% 透明安全边**，避免耳尖、尾梢、武器刃尖贴边裁切；足部/爪部稳落下方水平线，方便战斗舞台叠加投影与受击震动动效。

### 2. 推荐分辨率分档
| 敌方体型类别 | 推荐分辨率 | 比例 | Midjourney 参数 | 适用编号 |
| --- | --- | --- | --- | --- |
| **人形侍卫 / 术士 / 罗文** | `768 × 1024` | `3:4` | `--ar 3:4` | `#01` `#09` `#10` |
| **四足魔兽 / 巨兽 / 裂岩冰蜥** | `1024 × 1024` | `1:1` | `--ar 1:1` | `#02` `#03` `#04` `#05` `#06` `#07` `#08` `#13` |
| **双阶段 Raid 大 Boss（东翼封锁官 / 风神·岚）** | `896 × 1152` | `7:9` | `--ar 7:9` | `#11` `#12` |

### 3. 零 404 优雅启用机制（按需整包或单张热接入）
引擎（`js/combat-engine.js` 第 `100–147` 行）已内建 `MONSTER_ART_FILES` 与 `window.MONSTER_ART_INSTALLED` 安全开关：
- **未放图时零 404**：默认不设置 `window.MONSTER_ART_INSTALLED` 时，引擎**不会发起任何图片请求**，直接渲染内置冰晶纹章 SVG（或既有角色立绘），浏览器控制台零 404 报错。
- **单张容错回退**：即使启用后某张 PNG 尚未导出，`<img>` 亦自带 `onerror` 自动回退至原纹章或原立绘，不会出现裂图。
- **方式 A · 全量整包启用**（13 张齐备后，在 `index.html` 加载 `js/combat-engine.js` 前或单独配置文件中写入一行）：
  ```html
  <script>
    window.MONSTER_ART_INSTALLED = true;
  </script>
  ```
- **方式 B · 逐张增量启用（清单模式）**（画完一张立刻看一张效果，支持按敌方 ID 或文件路径列表/对象开启）：
  ```html
  <script>
    // 数组形式（写敌方 key 或完整路径均可）
    window.MONSTER_ART_INSTALLED = [
      'rowan',
      'wolf_alpha',
      'assets/monsters/wind_god_tempest.png'
    ];

    // 或对象映射形式（方便逐项开关）
    // window.MONSTER_ART_INSTALLED = { rowan: true, wind_god_avatar: true };
  </script>
  ```
- **独立变体映射升级提示**：当前 `js/combat-engine.js` 的默认 `MONSTER_ART_FILES` 中，以下 4 个子单位先复用了同系主档路径以减少初期画量——当你把对应的独立变体也画好后，只需在页面初始化脚本里覆盖映射（或同步更新 `MONSTER_ART_FILES` 对应行）即可秒切专属立绘：
  ```html
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      if (window.CombatEngine && window.CombatEngine.MONSTER_ART_FILES) {
        Object.assign(window.CombatEngine.MONSTER_ART_FILES, {
          frost_hound_a: 'assets/monsters/frost_hound.png',
          frost_hound_b: 'assets/monsters/frost_hound.png',
          ridge_claw: 'assets/monsters/ridge_claw.png',
          corridor_vanguard: 'assets/monsters/corridor_vanguard.png',
          flame_mage_a: 'assets/monsters/flame_mage.png',
          frost_lizard: 'assets/monsters/frost_lizard.png',
        });
      }
    });
  </script>
  ```
  > 注：`#13 frost_lizard.png` 对应第三卷主线 `js/story-vol3.js`（`{ battle: { tpl: 'frost_lizard', scale: 0.85 } }`）与 `game.js` 中 `ENEMY_TEMPLATES.frost_lizard` 的经典 Boss 战；未来接入经典战立绘框或演武场扩展时可直接沿用该路径。

### 4. 全部 13 张立绘总对照表
| # | 文件路径 | 关卡 / 剧情出处 | 引擎敌方 ID / Key | 尺寸 | 当前映射状态 |
| :-: | --- | --- | --- | :-: | --- |
| 01 | `assets/monsters/rowan_eclipse.png` | Act 02 · 乱葬岗活捉战（间章） | `rowan` / `rowan_graveyard` | `768×1024` | 已直连 |
| 02 | `assets/monsters/wolf_alpha.png` | Act 06 W1 · 北林群狼 | `wolf_alpha` | `1024×1024` | 已直连 |
| 03 | `assets/monsters/pack_wolf.png` | Act 06 W1 · 北林群狼（通用） | `wolf_b` / `wolf_c` / `wolf_d` / `pack_wolf` | `1024×1024` | 已直连 |
| 04 | `assets/monsters/shadow_jackal.png` | Act 06 W2 & 第三卷 · 霜脊影豺 | `shadow_jackal` / `jackal` | `1024×1024` | 已直连 |
| 05 | `assets/monsters/tundra_brute.png` | Act 07 W1 · 赫兰冻土兽潮 | `tundra_brute` / `hulan_brute` | `1024×1024` | 已直连 |
| 06 | `assets/monsters/frost_hound.png` | Act 07 W1 & 第四卷 · 霜原狂狼 / 雪狼先锋 | `frost_hound_a` / `frost_hound_b` | `1024×1024` | 默认复用 `pack_wolf`，画毕可切专属 |
| 07 | `assets/monsters/abyss_behemoth.png` | Act 07 W2 Boss · 霜渊裂地兽·领主 | `abyss_behemoth` / `hulan_lord` | `1024×1024` | 已直连 |
| 08 | `assets/monsters/ridge_claw.png` | Act 07 W2 · 寒脊爪兽 | `ridge_claw` | `1024×1024` | 默认复用 `shadow_jackal`，画毕可切专属 |
| 09 | `assets/monsters/corridor_vanguard.png` | Act 08 W1 · 东翼火廊突围战 | `corridor_vanguard` | `768×1024` | 默认复用 `eastwing_commander`，画毕可切专属 |
| 10 | `assets/monsters/flame_mage.png` | Act 08 W1 · 东翼火廊突围战 | `flame_mage_a` | `768×1024` | 默认复用 `eastwing_commander`，画毕可切专属 |
| 11 | `assets/monsters/eastwing_commander.png` | Act 08 W2 Boss · 东翼封锁官·红莲铁幕 | `eastwing_commander` / `eastwing` / `turning_point_corridor` | `896×1152` | 已直连 |
| 12 | `assets/monsters/wind_god_tempest.png` | Act 09 Boss · 风神·岚（纯透明抠图立绘） | `wind_god_avatar` / `wind_god_eye` | `896×1152` | 已直连（替换方形天空 CG） |
| 13 | `assets/monsters/frost_lizard.png` | 第三卷主线 Boss · 裂岩冰蜥 | `frost_lizard`（`ENEMY_TEMPLATES`） | `1024×1024` | 第三卷经典战 / 扩展槽 |

### 5. 通用负面提示词（Shared Negative Prompt）与去背流水线

> **去背实用技巧**：所有正向提示词均引导模型输出 **纯白单色底（`isolated on pure solid white background`）**，避免直接写“transparent background”导致模型错画灰白假棋盘格；出图后直接通过 **RMBG-2.0 / BiRefNet / ComfyUI Inspyrenet / Photoshop 主体去背** 即可一键获得极其干净的 32-bit RGBA 透明立绘。

**SDXL / Illustrious / Animagine XL / ComfyUI / NovelAI 通用 Negative Prompt（直接复制）：**
```text
background, scenery, landscape, sky, clouds, floor, ground, pedestal, room interior, dark background, gradient background, checkerboard background, transparency grid, text, typography, logo, watermark, signature, artist name, frame, border, dark border box, card frame, UI elements, speech bubble, extra limbs, extra legs, extra arms, extra tails, extra heads, fused limbs, deformed anatomy, bad proportions, mutated hands, missing fingers, cropped head, cropped ears, cropped weapon, cut off feet, blurry, lowres, jpeg artifacts, muddy shading, overly dark lighting, 3d cgi render, photorealistic, live action, facing right
```

**Midjourney（Niji 6 / v6）快捷后缀参考：**
```text
--niji 6 --style raw --no background scenery sky floor text watermark border frame card box extra limbs cropped facing right
```
- **SDXL / Illustrious 建议参数**：Sampler `DPM++ 2M SDE Karras` 或 `Euler a`，Steps `28–34`，CFG `5.5–6.5`。
- **Flux.1 Dev 建议参数**：Steps `24–28`，Guidance `3.5`，去掉过重质量词权重符号即可直接使用下方英文 Prompt。

---

## 二、全部 13 张怪物 & Boss 完整提示词（Copy-Paste Ready）

> 每一条英文提示词均严格以 `masterpiece, 4k, ultra-detailed, ` 开头，已内置 **面朝左侧（facing left）**、**纯白单色底便于抠图** 及 **原著剧情特征与冰晶宫殿破绽细节**。

---

### 01. 罗文（圣级血族侍卫·晦轮杖）
- **保存路径**：`assets/monsters/rowan_eclipse.png`
- **出处 / ID**：Act 02 间章《白昼里的夜》· 乱葬岗活捉战（`rowan` / `rowan_graveyard`）
- **推荐尺寸**：`768 × 1024`（`3:4`）
- **原著设定要点**：深褐色短发、神色沉定克制的年轻贵族侍卫（实为圣级血族），一袭利落贴身黑衣配暗银色内衬滚边；右手持黑木短杖**「晦轮杖」**（杖顶嵌一圈冷月日蚀般的暗银细环），大拇指微松呈蓄势掷杖姿态，苍白左手轻抬，周身逸散细缕暗紫银月折光雾气。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel anime character standee illustration, full body portrait of Rowan, a composed aristocratic young vampire palace guard in his early twenties, facing left in a poised three-quarter battle stance, short neatly combed dark brown hair, pale alabaster skin, deceptively calm refined face with sharp calculating eyes glowing with a subtle crimson-violet glint, wearing sleek fitted black medieval-fantasy combat attire with high collar, dark silver trim lining, silver-buckled belt, fitted leather gloves and tall black boots, right hand gripping a short ebony-black magic wand topped with a delicate dark-silver lunar eclipse ring (Eclipse-Ring Wand), thumb subtly loosened on the wand hilt ready to flick-cast, slender pale left hand raised in a restrained guard gesture, faint wisps of pale silver moonlight and dark-violet refraction aura curling delicately around the eclipse ring, crisp fine anime lineart, luminous painterly cel-shading, cool silver-moon rim lighting, clean full-body silhouette with breathing margin, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 02. 灰棘头狼（北林狼群首领）
- **保存路径**：`assets/monsters/wolf_alpha.png`
- **出处 / ID**：Act 06 Wave 1 · 第三卷北林群狼（`wolf_alpha`）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：比普通灰棘狼更高大魁梧的头狼，铁灰与银灰粗硬毛发，**脊背与颈项耸立一排倒竖的尖锐暗灰硬棘**，口鼻带旧伤疤，双眸猩红（与普通狼区分，便于战斗中一眼识别集火核心），周身缠绕淡淡风系青银气流，低伏昂首嘶吼面向左方。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG monster standee illustration, full body of a towering alpha dire wolf pack leader, facing left in a fierce aggressive stance ready to howl and pounce, massive muscular frame larger than ordinary wolves, thick coarse iron-gray and slate-silver fur with dense bristling rows of jagged dark charcoal thorn-like quills standing upright along its neck and spine ridge, battle-scarred snout, bared razor-sharp white fangs, intense glowing crimson-red alpha eyes, sharp tufted ears, subtle translucent pale cyan-silver wind mana streaks swirling lightly around its ruff and claws, crisp clean anime lineart, high-clarity painterly cel-shading, bright cool rim lighting, complete uncropped silhouette from ears to paws and tail, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 03. 灰棘狼（北林群狼通用）
- **保存路径**：`assets/monsters/pack_wolf.png`
- **出处 / ID**：Act 06 Wave 1 · 灰棘狼甲/乙/丙（`wolf_b` / `wolf_c` / `wolf_d` / `pack_wolf`）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：精瘦凶悍的普通灰棘狼，灰褐色皮毛与较短的背脊黑棘（体格与气场刻意弱于头狼 `#02`，便于多狼同屏排布不显杂乱），琥珀冰蓝兽瞳，压低身躯呈斜向包抄扑咬姿态，面朝左侧。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG monster standee illustration, full body of a lean feral gray thorn-backed forest wolf, facing left in a low crouching flanking pounce posture, slender agile body visibly more compact than an alpha wolf, ash-gray and weathered winter-taupe fur with a modest ridge of short spiky dark-gray bristles along its back, snarling jaws with sharp fangs, alert icy-amber predator eyes, wiry muscular legs braced to leap, faint wisps of pale wind dust trailing behind its paws, crisp clean anime lineart, luminous cel-shaded painterly texture, clean readable silhouette suitable for multi-unit RPG battle formation, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 04. 霜脊影豺（银级猎杀种）
- **保存路径**：`assets/monsters/shadow_jackal.png`
- **出处 / ID**：Act 06 Wave 2 & 第三卷北林东北山谷（`shadow_jackal` / `jackal`）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：银级高危伏击种，修长矫健如猎豹与胡狼结合的掠食体态；银灰与霜白斑驳毛皮，**高耸尖削的双耳**（原著公会交割战利品特征），沿脊椎排布一列锋利半透明冰晶霜刺，暗红玫瑰色冷酷兽瞳，四爪缠绕极淡的幽影残像冰雾，呈凌空扑喉瞬间面向左方。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG elite monster standee illustration, full body of a silver-rank Frost-Ridge Shadow Jackal, facing left in a razor-sharp mid-air ambush lunge toward the left, lithe elongated predatory canine-jackal physique with lean sinewy limbs, sleek silver-gray and frost-white mottled coat designed for winter forest camouflage, prominent tall sharply pointed ears tipped with dark silver fur, a sleek dorsal crest of jagged translucent pale-ice crystalline spines running down its arched back, glowing pale ruby-crimson slit eyes, snarling narrow jaws with gleaming fangs, ghostly wisps of shadowy blue-silver afterimage mist curling softly around its silent paws, crisp anime lineart, luminous painterly cel-shading, dynamic clean cutout silhouette, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 05. 冻土重甲兽（赫兰攻城兽）
- **保存路径**：`assets/monsters/tundra_brute.png`
- **出处 / ID**：Act 07 Wave 1 · 赫兰冰封峡谷协防战（`tundra_brute` / `hulan_brute`）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：土属性重装冲锋巨兽，厚重低矮的史前寒冰巨犀/重甲野猪体态；头顶、肩背与前肢覆满灰岩与万年冻冰交叠的厚重甲片，**前膝关节处刻意保留细微交叠甲缝**（呼应冰晶宫殿破绽线索！），一对覆霜弯角獠牙，沉头冲撞姿态面朝左方。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG monster standee illustration, full body of a Tundra Armored Siege Brute, massive heavy-set prehistoric frost boar-rhino hybrid beast, facing left with head lowered in an unstoppable battering-ram charging posture, thick layered slate-gray basalt rock and frozen glacier armor plates encasing its massive skull, humped shoulders, and thick flanks, distinct subtle overlapping armor plate seam visible at its front knee joint, twin curved frost-crusted ivory tusks, fierce icy-amber eyes beneath heavy brow armor, coarse dark frost-dusted fur peeking between rock plates, heavy stomping clawed hooves, faint puffs of cold frost vapor from nostrils, crisp anime lineart, rich painterly cel-shading, crisp uncropped silhouette, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 06. 霜原狂狼 / 雪狼先锋（北境冰牙狼群）
- **保存路径**：`assets/monsters/frost_hound.png`
- **出处 / ID**：Act 07 Wave 1 & 第四卷枯溪沟警号（`frost_hound_a` / `frost_hound_b` / 霜脊雪狼先锋）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：通体雪白与浅冰蓝渐变的北境冻原雪狼（视觉上明确区分于北林灰褐色 `pack_wolf`），肩颈厚实冰霜鬃毛，**发光的青蓝色冰眸**（原著第四卷明确描写「青眼先锋雪狼」）与半透明冰晶利齿，呼出白霜寒息，疾驰飞扑向左侧。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG monster standee illustration, full body of a ferocious Arctic Frost Hound / Snow-Ridge Vanguard Wolf, facing left in a high-speed lunging sprint across snow, dense snow-white and pale glacial-blue winter fur coat with frosted silver-blue mane around shoulders and ruff, fierce glowing cyan-blue eyes, open snarling muzzle with sharp crystalline icicle fangs and subtle wisps of freezing white breath vapor, translucent ice shards crusted lightly along its cheek fur and forelegs, muscular agile winter predator silhouette, crisp fine anime lineart, bright luminous glacial cel-shading, clean complete silhouette, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 07. 霜渊裂地兽·领主（赫兰冻土 5 星大 Boss）
- **保存路径**：`assets/monsters/abyss_behemoth.png`
- **出处 / ID**：Act 07 Wave 2 Boss · 赫兰冰封峡谷（`abyss_behemoth` / `hulan_lord`）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：5 星领主级巨兽，巍峨厚重的四足/半直立冰岩泰坦；背部覆盖**三寸厚锯齿灰岩冻甲**与高耸深蓝冰晶肩冠，前臂粗壮如岩柱；**胸腹下方岩甲裂缝间隐现一颗微裂发光的幽蓝散热晶核**（精准呼应原著中艾诺崖顶冰枪与希尔维亚冰宫共鸣锁核的决胜破绽！），扬起一只裹满冰岩的巨掌欲砸地施放寒震，面朝左侧。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG raid boss monster standee illustration, full body of the Abyssal Frost-Quake Behemoth Lord, a colossal permafrost earth-and-ice titan beast, facing left while rearing slightly with one massive glacier-crusted rocky forepaw raised to slam the ground, towering arched back covered in three-inch thick jagged slate-gray basalt rock carapace fused with razor-sharp deep sapphire glacier crystal crests, frost fissures cracking along massive forearms, a luminous glowing sapphire-cyan mana crystal core clearly pulsing through cracked armored plates on its lower chest and underbelly, fierce glowing ice-blue eyes set inside a horned glacial skull crest, swirling frost sparks and fine snow mist clinging only to its silhouette, epic boss presence, crisp refined anime lineart, high-detail painterly cel-shading, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 08. 寒脊爪兽（峡谷侧翼高速袭扰兽）
- **保存路径**：`assets/monsters/ridge_claw.png`
- **出处 / ID**：Act 07 Wave 2 · 赫兰冰封峡谷（`ridge_claw`）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：风属性高速侧翼袭扰魔物，细长灵动的冰原迅猛龙/霜猞猁混合体态；青灰钢鳞与覆霜短毛交错，沿背脊生有流线型寒风鳍棘，**一对修长锋利的半透明冰蓝钩爪**，长尾甩动保持平衡，正面向左方疾掠挥爪，带出极细的淡青风霜爪光。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG monster standee illustration, full body of a Frost-Ridge Clawed Stalker, an agile wind-element tundra skirmisher beast resembling a sleek frost-raptor and armored snow-lynx hybrid, facing left in a fast slashing mid-stride attack pose, streamlined athletic body covered in pale steel-blue scales and frost-rimmed slate-gray fur, swept-back icy dorsal ridge fin along its spine and long whip-like balancing tail, oversized razor-sharp translucent ice-blue scythe-like foreclaws gleaming with faint pale-teal wind slash arcs, narrow fierce glowing teal-gold eyes, sharp predatory snout, crisp anime lineart, luminous cel-shading, clean sharp silhouette, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 09. 宫廷突击队长（东翼政变先锋）
- **保存路径**：`assets/monsters/corridor_vanguard.png`
- **出处 / ID**：Act 08 Wave 1 · 第二卷终章东翼火廊突围战（`corridor_vanguard`）
- **推荐尺寸**：`768 × 1024`（`3:4`）
- **原著设定要点**：贝尔蒙派系宫廷突击队长，身披精钢与绯红镶边王都卫队半身板甲，敞面或半罩头盔下神情冷峻肃杀，深红战袍绣抽象王都火徽（不含文字），双手横握**精钢长戟**呈严密突刺/铁壁守势，戟刃映出暖红火光，面朝左侧。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel anime fantasy character standee illustration, full body of an Imperial Palace Assault Captain, stern battle-hardened male royal vanguard knight in his late twenties, facing left in a disciplined braced combat guard stance, wearing polished dark-steel half-plate armor with crimson-lacquered trim, antique gold-edged pauldrons, armored gauntlets, and a dark crimson waist tabard bearing a small abstract golden flame-crest emblem with no text, open-face steel guard sallet helmet showing cold determined eyes and sharp jawline, gripping a long gleaming polished-steel royal halberd angled diagonally forward to the left, subtle warm scarlet-orange firelight reflections along the armor edges and halberd blade, crisp fine anime lineart, luminous painterly cel-shading, clean full-body silhouette, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 10. 赤炎术士（东翼纵火咏唱者）
- **保存路径**：`assets/monsters/flame_mage.png`
- **出处 / ID**：Act 08 Wave 1 · 第二卷终章东翼火廊突围战（`flame_mage_a`）
- **推荐尺寸**：`768 × 1024`（`3:4`）
- **原著设定要点**：王都火系宫廷术士，身着深绯红与炭黑交织、绣金丝烈焰纹的高领长袍与护腕，兜帽半垂露出冷静锐利的双眸；**双手平举胸前结印催动赤炎火环**（精准对应战斗中「双手控场 · 侧翼真空」的视觉提示！），火星与绯红魔纹环绕双臂，面朝左侧。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel anime fantasy character standee illustration, full body of a Royal Crimson Flame Mage, slender sharp-featured court pyromancer facing left in a focused spell-channeling posture, wearing layered deep scarlet and charcoal-black aristocratic battle-mage robes embroidered with fine antique-gold flame filigree, high stiff collar, dark crimson half-hood casting light shadow over sharp glowing amber eyes, leather spell-sash with brass clasps, both hands raised level in front of chest channeling a swirling luminous scarlet-amber arcane fire seal and floating tongues of flame between the palms (clear two-handed casting pose), delicate glowing ember sparks orbiting the forearms, crisp fine anime lineart, high-clarity painterly cel-shading, clean full-body silhouette, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 11. 东翼封锁官·「红莲铁幕」（政变火夜 5 星 Boss）
- **保存路径**：`assets/monsters/eastwing_commander.png`
- **出处 / ID**：Act 08 Wave 2 Boss · 第二卷终章转折点（`eastwing_commander` / `eastwing` / `turning_point_corridor`）
- **推荐尺寸**：`896 × 1152`（`7:9`）
- **原著设定要点**：双阶段 5 星宫廷 Boss，高大威严的王都铁血封锁官；黑曜精钢与鎏金全套礼仪战甲，**甲面刻满流转炽红火光的魔纹**，肩披饰有**红莲烈焰纹章的猎猎绯红长披风**，手握华丽鎏金红莲长戟，身后半环绕旋转的绯红莲瓣烈焰光轮与零星飞溅火星，霸气逼人面朝左侧。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel anime fantasy raid boss character standee illustration, full body of the Eastwing Lock-Down Commander "Crimson Lotus Iron Curtain", an imposing tall royal marshal-inquisitor in his thirties with commanding ruthless aristocratic aura, facing left in an authoritative boss battle stance, wearing ornate obsidian-steel and gilded full ceremonial plate armor etched with glowing scarlet flame-mana runes, sweeping high-collared crimson velvet war-cloak embroidered with an intricate gold-and-scarlet lotus flame emblem, dark gold crown-circlet helm framing silver-streaked dark hair and piercing fiery eyes, wielding a grand gilded halberd with a glowing crimson lotus-flame blade held diagonally forward to the left, radiant orbiting rings of stylized scarlet lotus fire petals and rising golden embers framing only the figure tightly without clutter, epic raid boss silhouette, crisp fine anime lineart, rich luminous painterly cel-shading, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 12. 风神·岚（七大列强 · 纯透明抠图立绘，替换方形天空 CG）
- **保存路径**：`assets/monsters/wind_god_tempest.png`
- **出处 / ID**：Act 09 Boss · 特别试炼「岚之试剑」（`wind_god_avatar` / `wind_god_eye`，替换旧版带天空花海背景的 `fengshen_normal.png`）
- **推荐尺寸**：`896 × 1152`（`7:9`）
- **原著设定要点**：严格承袭现有 `assets/portraits/fengshen_normal.png` 的角色外观基因——**及腰飘逸浅青翠/翡翠长发**、清冷微带戏谑的苍翠银蓝双眸、额际点缀精致金叶小白花冠饰、**轻盈半透的珍珠白风拂丝绸神袍配古金色藤蔓腰饰**、**赤足戴细金脚链悬浮离地半寸**；**单手随意负于身后**、另一手向左侧优雅轻抬，周身环绕通透的青银旋岚风刃圆环与柔和风眼流光。**100% 纯白底无天空无花田**，抠图后直接作为顶级透明立绘降临战斗舞台！

```text
masterpiece, 4k, ultra-detailed, Japanese light novel anime fantasy goddess boss standee illustration, full body of Wind God Arashi (Fengshen), one of the Seven Great Powers, an ethereal transcendent anime goddess hovering effortlessly half an inch in midair, facing left in a graceful composed sword-trial stance, long cascading luminous pale celadon-emerald mint-green hair flowing weightlessly in a serene inner breeze, calm piercing pale emerald-silver eyes with a subtle effortless teasing smirk, delicate antique-gold laurel and small white blossom hairpiece, dressed in flowing sheer translucent pearl-white wind-swept silk robes and layered gossamer drapery accented with intricate antique-gold filigree bodice ornament and shoulder clasps, barefoot with delicate gold ankle chains, one hand casually tucked behind her back while the other extends gracefully toward the left summoning sleek concentric translucent cyan-silver gale-blade rings and luminous wind-eye vortex ribbons curling neatly around her figure, celestial airy radiance, crisp delicate anime lineart matching high-end light novel character art, luminous painterly cel-shading, zero sky or flowers, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

### 13. 裂岩冰蜥（第三卷主线冻土 Boss）
- **保存路径**：`assets/monsters/frost_lizard.png`
- **出处 / ID**：第三卷第四章《奔赴北境》· 风口窄道伏击战 Boss（`frost_lizard` · `js/story-vol3.js` 第 840 行 & `game.js` `ENEMY_TEMPLATES.frost_lizard`）
- **推荐尺寸**：`1024 × 1024`（`1:1`）
- **原著设定要点**：赫兰冻土重型冰岩巨蜥，粗壮低趴、冲撞力极强；**全身披覆厚重灰蓝色冰岩重甲鳞片与加固钝角额甲**，背脊至粗重长尾竖起棱角分明的苍蓝冰晶棱刺；**下颌与胸腹交界处露出浅色分节腹甲缝隙**（精准呼应原著中希尔维亚与艾诺「顺冰蜥下颌与腹甲缝隙斜刺」的战斗描写！），四爪深扣地面、张口咆哮吐出寒霜雾气，面朝左侧。

```text
masterpiece, 4k, ultra-detailed, Japanese light novel fantasy RPG boss monster standee illustration, full body of a Rock-Cleaver Frost Lizard (Giant Permafrost Ice Drake-Monitor), facing left in a powerful low-slung head-on charging crouch ready to ram, heavily built reptilian colossus encased in thick overlapping slate-blue and glacier-gray ice-rock armored scales, reinforced horned battering-ram forehead crest, jagged crystalline ice-blue spikes erupting along its arched spine and thick muscular tail, subtly paler segmented underbelly and throat plate seams visible beneath its armored jaw, wide powerful clawed legs braced firmly, wide snarling jaws exhaling crisp wisps of freezing frost mist, fierce glowing ice-yellow reptilian eyes, crisp clean anime lineart, rich luminous glacial cel-shading, uncropped complete silhouette from snout to tail tip, isolated on pure solid white background, no background elements, ready for transparent PNG cutout
```

---

## 三、可选扩展位：自由探索养成行动插画 / Q 版卡片（Optional Future Activity Vignettes）

> **当前版本 100% 零依赖正常运行**：自由探索底部操作栏（`#action-bar`）的 `地图`、`交谈`、`修行`、`学习`、`课程`、`休息`、`物品`、`奇遇`、`下个季度` 已采用定制冰晶矢量 SVG 与清朗绘本排版，**完全不需要任何额外图片即可完美运行且零 404**。

如果未来希望在消耗体力进行日常养成（如上课、修行、泡图书馆、喝茶小憩）时，于叙事弹卡或行动结果条中点缀轻巧的 **水彩轻小说小插画 / Q 版静物徽卡**，可按以下约定的可选扩展位准备素材，并沿用相同的零 404 开关思路（例如 `window.ACTIVITY_VIGNETTES_INSTALLED = true`）：

| 可选槽位路径 | 对应行动按钮 | 建议规格 | 建议画面主题 |
| --- | --- | :-: | --- |
| `assets/vignettes/act_course.png` | `课程`（`data-act="course"`） | `512 × 512`（1:1 透明或圆角） | 学院橡木课桌、冰蓝魔力晶球、羽翼羽毛笔与翻开的魔法手札 |
| `assets/vignettes/act_train.png` | `修行`（`data-act="train"`） | `512 × 512`（1:1 透明或圆角） | 晨雾中的乌木铁剑斜插霜地、半透明菱形冰晶绕剑身旋舞 |
| `assets/vignettes/act_study.png` | `学习`（`data-act="study"`） | `512 × 512`（1:1 透明或圆角） | 堆叠的精装古籍、淡蓝水晶书签、暖金烛台与北极铃兰干花 |
| `assets/vignettes/act_tea.png` | `休息 / 茶歇`（`data-act="rest"`） | `512 × 512`（1:1 透明或圆角） | 绘有银蓝冰花纹的骨瓷红茶杯、奶油蛋糕与窗边飘落的小雪花 |

### 可选插画示例提示词（如需扩充时直接复制，风格与正文立绘完全统一）

#### 课程（`assets/vignettes/act_course.png`）
```text
masterpiece, 4k, ultra-detailed, Japanese storybook light novel item vignette illustration, luminous frosted sapphire magic crystal orb resting beside an open leather-bound spellbook with neat geometric ice runes and a silver-nibbed white feather quill, delicate floating ice sparkles, bright glacial crystal and porcelain palette, clean painterly anime watercolor-cel style, isolated on pure solid white background, no text, ready for transparent PNG cutout
```

#### 修行（`assets/vignettes/act_train.png`）
```text
masterpiece, 4k, ultra-detailed, Japanese storybook light novel item vignette illustration, a sleek dark ebony practice sword wrapped in a razor-thin translucent steel-ice aura surrounded by orbiting diamond ice crystals and soft pale blue frost mist, luminous glacial sapphire and silver highlights, crisp anime painterly style, isolated on pure solid white background, no text, ready for transparent PNG cutout
```

#### 藏书 / 学习（`assets/vignettes/act_study.png`）
```text
masterpiece, 4k, ultra-detailed, Japanese storybook light novel item vignette illustration, a neat stack of royal navy and ivory hardcover fantasy grimoires tied with a sapphire ribbon, an antique brass reading lamp casting gentle warm light, and a pressed white polar lily bookmark, harmonious cool-blue and warm-cream storybook lighting, crisp anime painterly style, isolated on pure solid white background, no text, ready for transparent PNG cutout
```

#### 茶歇 / 休息（`assets/vignettes/act_tea.png`）
```text
masterpiece, 4k, ultra-detailed, Japanese storybook light novel item vignette illustration, an exquisite white porcelain teacup with silver-blue snowflake filigree filled with steaming amber black tea, accompanied by a petite strawberry cream cake slice on a matching saucer and tiny floating crystal snowflakes, gentle cozy pastel fairytale lighting, crisp anime painterly style, isolated on pure solid white background, no text, ready for transparent PNG cutout
```

---

## 四、上线前自检清单（Quick QA Checklist）
1. **文件命名核对**：逐一比对上表 13 个文件名（全小写、下划线、`.png` 扩展名），放入 `assets/monsters/`。
2. **朝向检查**：所有怪物与 Boss 均面向 **左侧**（`←`），放上右侧战斗台后自然面朝希尔维亚。
3. **透明通道检查**：在深蓝与纯白两种底色下分别预览，确认无锯齿白边、无伪棋盘格、无残留底色块。
4. **版本入库（遵守 `AGENTS.md` 第〇条）**：图片落盘并核验无误后，记得 `git add assets/monsters/ && git commit && git push origin main`，避免新立绘滞留未跟踪状态。
