/* =========================================================
   转生千金 · 间章《白昼里的夜》原著实装剧本
   由 game.js 的 mergeStory() 合并入 SCENES 与 STORY_CHAPTERS
   ========================================================= */
(function (global) {
  'use strict';

  const STORY_VOL4_CHAPTERS = [
    { id: 's_interlude_white_night', vol: '间章', title: '白昼里的夜', phase: 'youth' },
  ];

  const T = (text, extra) => Object.assign({ text }, extra || {});
  const P = (ids) =>
    (Array.isArray(ids) ? ids : [ids]).filter(Boolean).map((x) =>
      typeof x === 'string'
        ? { id: x, slot: 'center', emo: 'normal' }
        : { id: x[0], slot: x[1] || 'center', emo: x[2] || 'normal' }
    );
  const N = (text, ids, extra) => Object.assign({ text, portraits: P(ids || []) }, extra || {});
  const SAY = (id, speaker, emo, text, extra) => Object.assign({
    portraits: [{ id, slot: 'center', emo: emo || 'normal', active: true }],
    speaker,
    text,
  }, extra || {});

  /** 稳定槽位双人对话：主角在场固定左，否则按传入的首位主导者固定左、对方固定右 */
  const DUO = (a, b, speaker, text, extra) => {
    let left = a, right = b;
    if (a[0] === 'sylvia' || b[0] === 'sylvia') {
      left = a[0] === 'sylvia' ? a : b;
      right = a[0] === 'sylvia' ? b : a;
    }
    const aSpeak = speaker === left[0];
    return Object.assign({
      portraits: [
        { id: left[0], slot: 'left', emo: left[2] || 'normal', active: aSpeak },
        { id: right[0], slot: 'right', emo: right[2] || 'normal', active: !aSpeak },
      ],
      speaker: aSpeak ? left[1] : right[1],
      text,
    }, extra || {});
  };

  /** 对话间穿插的动作/神态旁白：保留双方立绘并全部置暗 */
  const DIM = (a, b, text, extra) => {
    let left = a, right = b;
    if (a[0] === 'sylvia' || b[0] === 'sylvia') {
      left = a[0] === 'sylvia' ? a : b;
      right = a[0] === 'sylvia' ? b : a;
    }
    return Object.assign({
      portraits: [
        { id: left[0], slot: 'left', emo: left[2] || 'normal', active: false },
        { id: right[0], slot: 'right', emo: right[2] || 'normal', active: false },
      ],
      text,
    }, extra || {});
  };

  /** 主角或视角角色第一人称内心独白：单人立绘高亮 */
  const MONO = (id, emo, text, extra) => Object.assign({
    portraits: [{ id, slot: 'center', emo: emo || 'normal', active: true }],
    text,
  }, extra || {});

  function isInteractiveBrowser() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return !/jsdom/i.test(navigator.userAgent || '');
  }

  // 间章跨年龄演出时暂存原进度，结束后若原本高于8岁则无缝归位
  let _interludeSaved = null;

  const SCENES = {};

  // =========================================================================
  // 间章《白昼里的夜》（6岁→7岁→8岁 · 「静止的日蚀」与月影迟滞）
  // =========================================================================
  SCENES.s_interlude_white_night = {
    bgm: 'suspense',
    bg: 'bg-img-forest bg-forest',
    loc: 'road',
    useOriginalSylvia: true,
    card: { vol: '间章', t: '白昼里的夜', s: '静止的日蚀' },
    lines: [
      {
        do: () => {
          flag('named', 1);
          _interludeSaved = (S.ageY > 8 || S.phase === 'journey' || S.phase === 'academy')
            ? { ageY: S.ageY, phase: S.phase, loc: S.lastSafe || S.loc }
            : null;
          S.ageY = 6;
          S.phase = 'youth';
          updateHUD();
        },
      },

      // —— 第一幕：六岁·西边引水渠与初遇罗文 ——
      T('六岁那年，雷纳德叔叔离开公爵府没多久，西边林道旁边死了一个人。', { bg: 'bg-img-forest bg-forest', loc: 'road', portraits: [] }),
      T('我原本是去看那一带新挖的引水渠。父亲答应过，等水渠修好，就把南花园那块总是半死不活的草地重新种一遍。'),
      T('贝阿特丽丝姐姐对此提出了很多建设性意见，比如种一片火红色的花，再修一座和她一样高的雕像——父亲采纳了前半句。'),
      T('尸体就倒在离水渠没几步远的灌木后面。发现他的侍卫先喊了一声，随后立刻挡到我面前，动作很快，态度也很坚决，好像只要他站得足够直，后面的死人就会自动消失。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '侍卫', text: '二小姐，请回马车。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '已经看见了。' },
      T('空气顿了顿，这就有点尴尬了。另一个年轻侍卫从灌木后走出来，单膝跪下检查死者。他的头发是很深的褐色，五官不算醒目，眼睛却很安静。', { portraits: [] }),
      MONO('sylvia', 'normal', '后来我才知道，他叫罗文。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '是个车夫，死了至少一夜。脖子上有伤，身上没有明显财物。' },
      T('他说话慢条斯理，对我能听懂的词也照直说。旁边的侍卫咳了一声，示意这里还有个六岁小孩。罗文抬眼看我。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐怕吗？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '还好。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '那也别看太久。' },
      T('他说着站起来，正好把尸体挡住。我只来得及看见一张苍白得过分的脸，脖颈侧面两个相隔很近的孔，还有一双干净的靴子。', { portraits: [] }),
      MONO('sylvia', 'normal', '昨夜下过雨，林道上全是泥。一个自己走进灌木丛的人，靴底不该那么干净。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '他是被人搬到这儿来的。' },
      T('几名侍卫同时看向我。罗文也低头看了一眼鞋底。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '为什么？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '泥。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '也许他从另一边过来。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '另一边有荆棘。他的裤脚没破。' },
      T('罗文沉默了一会儿，然后笑了。那笑容离哄小孩的夸张差得远，嘴角很轻地动了一下而已。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐看得真仔细。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '刚刚才看到。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '是啊。' },
      T('他让人把我送回马车，自己留在了灌木旁。那件事最后被定成了魔兽袭击——据说死者是个替人运私盐的车夫，得罪过不少人，验尸的人把脸白得像纸归咎于失血过多。', { portraits: [] }),
      T('听起来每一句都说得通，连在一起，却哪里都有一点勉强。不过我那时六岁，公爵千金不该对一具尸体表现出太大兴趣。'),
      T('母亲会担心，父亲会给护卫队加人，姐姐会提着木剑在府里巡逻——而巡逻唯一能吓到的，大概只有花园里的麻雀。于是我把后面的问题咽了回去。'),
      T('当晚躺在床上，我把白天的画面一五一十过了一遍。倒有一条不知从哪里冒出来的传闻，在城西的酒馆里悄悄活了下来：有人说，凶手跟魔兽不沾边，是夜里喝血的东西。'),

      // —— 第二幕：七岁·旧磨坊、奶油蛋糕与长廊问询 ——
      T('转眼到了七岁，第二具尸体出现在旧磨坊。据说死的是地下赌场的收债人，被人靠墙放得端端正正，双手交叠在腹前，像是睡着了；脖子上仍然是两个孔，脸色苍白，周围没多少血。', {
        bg: 'bg-img-dining bg-hall',
        loc: 'dining',
        portraits: [],
        do: () => { S.ageY = 7; updateHUD(); },
      }),
      T('同样的传闻从酒馆跑进了市集。那天午后用点心，管事进来向父亲回话，嗓音压得很低，但「吸血鬼」三个字还是落进了满桌人的耳朵。'),
      N('贝阿特丽丝姐姐正往嘴里塞一块奶油蛋糕，当场差点噎住。', [['beatrice', 'center', 'surprised']]),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'surprised'], 'beatrice', '咳、咳咳——我们领地有吸血鬼？！'),
      DUO(['claude', '父亲'], ['beatrice', '贝蒂', 'serious'], 'claude', '只是传闻。'),
      DUO(['claude', '父亲'], ['beatrice', '贝蒂', 'serious'], 'beatrice', '那也不行呀！它要是敢来公爵府，我就把它烤成灰！'),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'serious'], 'sylvia', '……姐姐，先把奶油擦掉。'),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'surprised'], 'beatrice', '哪里？'),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'surprised'], 'sylvia', '鼻子。'),
      N('爱丽丝安静地递过去一块手帕。父亲看着我们三个，揉了揉眉心，最后还是给城内巡逻添了好几班岗。', [['alice', 'center', 'normal']]),

      T('罗文也是从那时开始经常出现在我的随行队伍里，同批调来的还有塞姆和卡尔。塞姆最精神，兜里常年揣着几块饴糖，递过来时郑重得像在交接公文，总把「跟着罗文前辈，能学到最多东西」挂在嘴边。', { bg: 'bg-img-hallway bg-hall', loc: 'hallway', portraits: [] }),
      T('卡尔年纪大些，话少，往那儿一站像半截钉进地里的桩子。至于罗文，他很适合当侍卫——我想看书，他就把车帘拉到不晃眼的位置；姐姐想翻墙，他总能在墙的另一边提前等着。'),
      T('塞姆负责问累不累，罗文负责让人真的不累。最后一项尤其难得。'),
      T('旧磨坊的案子查了一阵子。负责问询的骑士来公爵府核对第一桩案子的细节，因为我恰好见过那具尸体，也被问了几句。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '问询骑士', text: '当时天气怎么样？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '前一晚下过雨，早上才停。林道边上一排白桦还在滴水。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '问询骑士', text: '现场是什么情形？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '尸体仰面倒在灌木后头，离水渠没几步。脖子上的两个孔挨得很近。靴底是干净的。' },
      T('骑士低头翻了半天记录。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '问询骑士', text: '……记录上只写了兽袭，现场无异常。' },
      MONO('sylvia', 'normal', '哼，明明我在当年案件最开始就提出了异常，却多半因为最后没有查出结果，就直接不作记录，真是便利呢。要不要让父亲减减他们的薪水？'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '下了整夜的雨，林道上全是泥。自己走进灌木的人，靴底不该干净。裤脚也完好，那一带只有荆棘。' },
      T('骑士的笔悬了一会儿，没落下去。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '问询骑士', text: '二小姐，您确定是去年看到的那一具？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '只看过一具。' },
      T('骑士的表情变得有些复杂。站在门边的罗文没有说话，问询结束后，才替我推开走廊的门。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐的记性，比我想的还要好。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '还好。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '隔了一年，连靴底的泥都记得？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '满地的泥，就他那双靴子是干净的。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '原来如此。' },
      T('他点了点头，没有继续问。第二桩案子最后也没有查出结果——死者们孤身一人，营生都上不得台面。传闻却还活着，它不过是暂时躲进了夜里。', { portraits: [] }),

      // —— 第三幕：八岁·冰晶宫殿觉醒、皮具店暗查与白昼日蚀 ——
      T('八岁那年，我成为中级魔法师、冰晶宫殿出现在意识里后没过多久，第三个人死了——死者是个替黑市伪造身份文书的掮客，伤口与惨白面色如出一辙。', {
        bg: 'bg-img-parlor bg-hall',
        loc: 'parlor',
        portraits: [],
        do: () => { S.ageY = 8; updateHUD(); },
      }),
      T('三桩案子终于惊动王都，骑士、治愈师与文书官组成的调查组进驻领地。我被请去核对首案卷宗时发现，三份验尸记录都写着伤口边缘有一圈很浅的淤痕——活牙咬进活肉，边缘才会淤。'),
      T('调查组借走了护卫队的轮值册，可符合条件的本地人能在城里抄出长长一列，谁也不扎眼。有一回，我回头时正撞上罗文在看我。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '有事？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '没有。只是觉得，如果这世上真有人能把那三桩案子连起来，应该是二小姐。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '调查组有那么多人。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '人多不一定看得清。' },
      T('听起来像夸奖，我没有接话。没过几天，第四桩案子来了——城南一家皮具店的老板死在工作间里，脖子上又是两个孔，蒜和银器的价钱一夜之间翻着跟头往上蹿。', { portraits: [] }),
      N('姐姐把一串蒜挂到了我门口，爱丽丝又默默取了下来。', [['beatrice', 'center', 'normal']]),
      DUO(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], 'beatrice', '为什么拿走？'),
      DUO(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], 'alice', '……姐姐大人不喜欢这个味道。'),
      DUO(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], 'beatrice', '可它能防吸血鬼呀！'),
      DUO(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], 'alice', '……厨房也需要。'),
      DIM(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], '两个人对视了一会儿，最后那串蒜回到了厨房。那阵子雷纳德叔叔恰好回府小住，天天歪在花园躺椅上翻闲书，抱怨日子无聊。'),
      T('王都调查组理所当然地把四桩案子串成了一桩，连守夜更夫都被带走盘问。第四份验尸记录没人会送到我面前，可要确认伤口边缘有没有淤痕，我只能自己去看。', { bg: 'bg-img-town bg-town', loc: 'town', portraits: [] }),
      T('我带着三位便装侍卫微服去店堂后头致哀。学徒马尔科腰系靛蓝围裙跪在灵前还礼，眼圈红着；街坊低声议论老板管账极严，前阵子还为工钱跟学徒大吵过一架。'),
      T('塞姆在灵前站得笔直，半天憋出一句「做工的人，走成这样，作孽」。我低头致哀时在意识里冻下老板颈侧的画面，经过半敞的工作间门口时顺手又冻了一段。'),
      T('从后门绕向马车时，台阶缝里卡着一小片靛蓝的布，台阶底下的排水沟口一片反复冲刷过的深色。车帘一落，我便闭眼进了冰晶宫殿。'),
      MONO('sylvia', 'serious', '先看灵堂那段——那两处孔眼边缘没有淤痕，齐得反常，甚至带着细小的直角，像被模子压出来的，和前三桩有本质区别。'),
      MONO('sylvia', 'normal', '再看工作间那段：台面上摆着一把双齿冲子，齿尖间距与脖侧两孔差不多；柜台上有块比周围干净的长方印子，账本却不见了。'),
      T('第二天，我讨来替府里取马缰的差事，验货时顺口问店里有没有一次能打两个并排孔眼的家什。马尔科答得极快——「没有」，右手拇指却一直在左手虎口上蹭。', { portraits: [] }),
      T('告辞经过工作间，台面收得一尘不染，那把双齿冲子已经不见了。塞姆落在最后，悄悄搁了块饴糖在柜台上，压低声音说是给人家「压压惊」。'),
      MONO('sylvia', 'normal', '每一条线都落在马尔科身上。只是按照传闻布置，做出的案件也只是像传闻而已——我将推理与搜查方向一条条写下来折好，准备以公爵千金的名义送去调查组驻地。'),

      T('那是正午，随行的侍卫仍是罗文、塞姆和卡尔三人。前面有运货车堵住了路，我不想继续等，便下车步行过去——刚走到街心，天突然黑了！', { bg: 'bg-img-town bg-town', loc: 'town', portraits: [] }),
      T('天上没有云，太阳却像被什么东西一口咬掉，光从街道两端迅速退去！魔法灯还没来得及亮，尖叫声、推车翻倒声与玻璃碎裂声一起撞进耳朵里。', { bg: 'bg-void', bgm: 'battle', sfx: 'bad', portraits: [] }),
      MONO('sylvia', 'surprised', '后颈先凉了一片——日蚀！卡萨天文台今晨的公告明明写着晴、无风、午后可能有薄云，今天本不该有日蚀！'),
      T('念头刚闪过去，屋顶上便落下一道人影：苍白、瘦削，嘴角沾着暗红血迹，两颗犬齿异常尖长，眼里没有焦点，落地后径直朝我扑了过来！', { portraits: [] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'surprised', active: false }], speaker: '罗文', text: '低头！' },
      T('塞姆抢在所有人前头横剑挡在我面前！一声让人牙酸的金属扭曲声过后，长剑竟被徒手撞折，塞姆胸口遭利爪贯穿，整个人向后飞撞在墙上！', { sfx: 'bad', portraits: [] }),
      T('卡尔从侧面劈过去，对方头也没回，反手抓住他手腕一拧，骨头断裂的声音清脆刺耳，卡尔闷哼着跪了下去。这一切前后不过几秒！'),
      MONO('sylvia', 'serious', '容不得我细想，冰墙自地面升起挡住下一记扑击，苍白的手指插进冰里，裂纹瞬间爬满整面墙。天黑那一刻我已冻下第一段记忆，此刻是第二段——冻结！'),
      T('罗文从我右后方掠过，剑锋绕开那只手，以刁钻角度直刺袭击者心口！我本能冻下第三段记忆——那人挣扎着回头，露出的赫然是马尔科的脸！', { portraits: [] }),
      T('罗文抽出剑再次连刺。日蚀在这时戛然而止，光重新落回街道，像有人猛地掀开一层黑布！周围人群终于看清地上的尸体，也看清满身是血的罗文。', { bg: 'bg-img-town bg-town', bgm: 'sad', portraits: [] }),
      T('他丢下剑，头一件事竟是转身检查我。我顺势冻下了第四段记忆。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐，受伤了吗？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '没有。' },
      T('塞姆死了，他兜里还剩着半把没发完的饴糖；卡尔重伤，右臂能不能保住还不知道。一个真正的凶手在白日的日蚀里现身，又在众人面前被护卫诛杀，沸沸扬扬的传闻仿佛终于有了结局。', { portraits: [] }),
      T('父亲亲自向罗文道谢。府里府外都在议论，往后我出门与其带一群反应不及的人，不如只带罗文一个——这话成了众人的共识，连白天的我也暂时放下了心。'),

      // —— 第四幕：冰晶宫殿推演板 · 月影迟滞与「静止的日蚀」 ——
      T('直到当天晚上，我坐在床边，把准备交给调查组的那张纸重新展开。', { bg: 'bg-img-ownroom bg-night', loc: 'ownroom', bgm: 'suspense', portraits: [] }),
      MONO('sylvia', 'serious', '杀老板那会儿，马尔科还得靠冲子压出两个孔；到了今天正午，獠牙却长在他自己嘴里，徒手撞折了塞姆的剑——这中间，有人咬了他。'),
      MONO('sylvia', 'serious', '何况他绝无可能知道我会在正午走哪条路，也不知道我刚查清真相。知道路线、又全程看我在皮具店查案的，只有三位随行侍卫——死去的塞姆、昏迷的卡尔，还有罗文。'),
      T('我闭上眼，进入冰晶宫殿。新冻结的四段记忆，正并排停在长廊尽头。', {
        bg: 'bg-void',
        portraits: [],
        do: () => {
          if (isInteractiveBrowser() && window.AmbientFX && typeof window.AmbientFX.openDeductionBoard === 'function') {
            try {
              window.AmbientFX.openDeductionBoard({
                title: '冰晶宫殿 · 寒夜记忆推演',
                subtitle: '检视白昼封存的四段记忆，比对《传说魔杖考》旧典，锁定唤来异常日蚀的施术者',
                prompt: '请点选能够直接交叉印证施术者破绽的两项核心证物：',
                clues: [
                  { id: 'mirror_1', label: '记忆·其一 · 正午日蚀', detail: '卡萨天文台今晨公告晴朗无风，正午长街却突降无云日蚀，显系人为挪动天光所致。', isKey: false },
                  { id: 'mirror_3', label: '记忆·其三 · 剑影迟滞', detail: '马尔科转身刹那，脚下影子和身体严丝合缝；而罗文出剑那半边，剑已刺到，剑影却悬在半空。', isKey: false },
                  { id: 'mirror_4', label: '记忆·其四 · 松剑影滞', detail: '阳光重回街道时，罗文的手已经离开剑柄，可他地面的影手却还没松开，整整慢了半拍！', isKey: true },
                  { id: 'book_staff', label: '藏书室 · 《传说魔杖考》', detail: '「静止的日蚀」借已达月亮之魔力挪动月影天光；自借影之时起，施术者之影迟于其身半拍，直至下一次月升。', isKey: true },
                ],
                requiredIds: ['mirror_4', 'book_staff'],
                conclusion: '真相锁死：在此之前全领地无人怀疑过罗文，唯有画面中慢了半拍的影子与《传说魔杖考》红墨注脚严丝合缝——唤来白昼黑夜的施术者，正是随行侍卫罗文！',
                skipLabel: '略过推演 · 直通下文',
              });
            } catch (e) {}
          }
        },
      }),
      {
        text: '四段记忆静悬在霜蓝长廊里，该先细察哪一处异样来拆穿这场白昼日蚀？',
        choices: [
          {
            text: '定格第四段记忆：阳光重回街道时，罗文的手已离开剑柄，地面投影却还没有',
            do: () => { addStat('mind', 2); flag('deduced_moon_shadow_lag', 1); },
            lines: [
              MONO('sylvia', 'surprised', '我在第四段记忆前停住——罗文的手已经离开剑柄，可地面影子的手还没有！再退回第三段换个重点细看，马尔科转身时脚下轮廓和身形严丝合缝，一步没错。'),
              MONO('sylvia', 'serious', '而罗文出剑那半边，剑已经到了，剑影却还悬在半空！一个影子迟了的人和一个影子没迟的人站在同一幅画面里——制造日蚀的另有其人，此前从未有人怀疑过罗文，此刻我是第一个看穿他的人。'),
            ],
          },
          {
            text: '比对第三段与第四段记忆：核查马尔科与罗文落在地面的影子轨迹',
            do: () => { addStat('mind', 2); flag('deduced_moon_shadow_lag', 1); },
            lines: [
              MONO('sylvia', 'serious', '第三段记忆里，马尔科正在转向，脚下影子和身体严丝合缝；可罗文刺剑那半边，剑锋已经递到，剑影却迟了半拍悬在半空。切到第四段，他已松开剑柄，影手却仍握着剑！'),
              MONO('sylvia', 'surprised', '那半拍的延迟在正午混乱里转瞬即逝，却逃不过冰晶宫殿冻结的记忆——众人都奉罗文为救主功臣，我成了第一个起疑的人。'),
            ],
          },
          {
            text: '沿着另一条长廊调取《传说魔杖考》：核对红墨圈出的那一行字',
            do: () => { addStat('mind', 1); addStat('mana', 1); flag('deduced_moon_shadow_lag', 1); },
            lines: [
              MONO('sylvia', 'serious', '我沿长廊调出先前冻下的《传说魔杖考》，再回头比对第三、第四段记忆——马尔科的影子一步没错，罗文无论出剑还是松手，影子都比身体慢了半拍，正与红墨注脚严丝合缝！'),
              MONO('sylvia', 'surprised', '白天里无人对这位温润守礼的侍卫存过半分疑心，直到这半拍错位的月影落进我眼里，整场戏的幕后之手才头一回现形。'),
            ],
          },
        ],
      },
      T('我沿着宫殿另一条长廊往前走，停在先前冻下的《传说魔杖考》前——其中一页，记载着一根叫「静止的日蚀」的魔杖。', { bg: 'bg-img-study bg-study', loc: 'study', portraits: [] }),
      MONO('sylvia', 'serious', '那一页记了两条。其一：能将少量魔力作用于月亮的人，可以借它挪动月影与天光，让本不在此地的日蚀降临并停驻。杖不会替人把魔力送上月亮，它只会挪动已经落在那里的那一点魔力。'),
      MONO('sylvia', 'normal', '其二：凡经此杖施展的魔法，造成的伤害一律转化为无视防御的真实伤害。像我这样不能把魔力送到月亮的人，就算日后握着它也无法唤来日蚀。而书页末尾，还有一行被前人用红墨圈出的字——'),
      T('「借月影者，月影亦借其身。自借影之时起，其影迟于其身半拍，直至下一次月升。」'),
      T('我退出冰晶宫殿。窗外已经入夜，月亮正从东边升起来，罗文的影子此刻大概已经恢复正常了。影子不会站上证人席，冻结的记忆也搬不进审判庭。', { bg: 'bg-img-ownroom bg-night', loc: 'ownroom', portraits: [] }),
      MONO('sylvia', 'serious', '马尔科的尸体下午已被验出真獠牙，傍晚拉去西郊乱葬岗埋了。惊动的人越多，罗文跑得越快、或者杀得越多——所以我需要一个能把他按在地上的人，然后让他自己开口，顺序不能反。'),
      T('门缝底下，不知什么时候多了一张折好的纸条，上面只有一行字：「今夜，马尔科坟前」。没有落款，也用不着落款——我会想到哪一步，他比谁都清楚。他想谈，那就谈。', { bgm: 'upset' }),

      // —— 第五幕：西郊乱葬岗对峙、雷纳德登场与可选活捉战 ——
      T('夜深时，我在西郊乱葬岗一片新翻过的土前停下。这里比想象中安静，野草长得过分茂盛，木牌歪歪斜斜，月光下浮着一层发白的薄雾。', { bg: 'bg-img-night bg-night', loc: 'road', portraits: [] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '我就知道您会来。' },
      T('我转过身，罗文从一块歪斜的墓碑后走出来。他换了一身便于行动的黑衣，右手握着一根不到手臂长的短杖——深蓝的杖身托着一圈悬浮的冰蓝色细环，环心静静停着一枚黑色的核，像一场停在半空的日蚀。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }] }),
      MONO('sylvia', 'serious', '「静止的日蚀」。他走到离我不远的地方停下——这个距离很讲究，足够说话，也足够我一转身就被追上。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '前三个人是你杀的。你先查到马尔科杀了老板，昨夜咬了他，再让他来袭击我。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '是。吊唁那天起我就站在您身后，您看的每一样东西我都看见了。那张纸折起来的时候，我就知道上面写了什么。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '所以你挑了正午——你需要一个故事，在我开口之前结束。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '传闻会停，调查组会离开。所有人都亲眼看见只有我救下了您，以后您出门只需要带我一个。这对您更安全。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '也让你变得不可替代。' },
      T('罗文笑了一下，将短杖横在身前，没有摆出攻击姿势，反而像是在献上一柄剑。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '被二小姐需要，算不上什么可耻的愿望。我不想杀您，我想继续做您的侍卫。我没有碰过公爵府里任何一个无辜的人，也从没想过伤害您的家人。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '塞姆。你刚刚漏了他。' },
      T('罗文握着短杖的手紧了一点。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '只要您答应，今后不会再有这种事。您只需要像以前一样信任我，我会是最安静、最可靠，也最不会背叛您的那个人。' },
      MONO('sylvia', 'serious', '从局面上看，这是一份很值得暂时接受的提议——我八岁，他是活了不知多少年的血族，离巡逻路远得很。先答应，回去再从长计议，任何一个头脑正常的人都会这么选。罗文也在等我这么选。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '想活下去没有罪，害怕被怀疑也没有罪。你甚至可以在第一桩案子之后告诉我真相，我会替你找不需要杀人的办法。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '可你为了证明自己值得信任，先让信任你的人去死。为了证明自己不可替代，先毁掉所有可以替代你的人。' },
      T('薄冰从我脚下无声地铺开，冰刃在月光下成形。', { sfx: 'magic', portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '这样的守护，我承担不起。守护，当不了杀人的免罪符。' },
      T('三道冰刃破雾射出！罗文侧身避开，速度比白天快得多，几乎在月光里拖出残影。我在他掠过的间隙里瞥见图鉴上终于填上的等阶一栏——圣级。整个王国数得过来的人物，替我拉了两年的车帘。', { bgm: 'battle', sfx: 'bad', portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '您不该一个人来。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '我知道。' },
      T('一面冰墙在他身后合拢，却被他反手用短杖敲碎！他穿过裂口欺至跟前，我向后退到脚跟撞上墓碑，退无可退，他的手停在我喉咙前。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '那为什么——还来？' },
      N('「——因为这一次，她身后还有人。」第三个人的声音从高处落下。雷纳德叔叔正蹲在歪脖子树上，像只嫌树枝太细的大鸟，打了个哈欠跳下来。', [['reno', 'center', 'normal']]),
      DUO(['sylvia', '希尔维亚', 'serious'], ['reno', '雷纳德'], 'reno', '一个人查案，一个人赴约，临开打前还要说句漂亮话——你的主角瘾过够没有？'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'sylvia', '……差不多。再晚半拍，我就当你睡着了。'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'reno', '要求真高啊，我在树上喂了半天蚊子。'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'sylvia', '现在是秋天。'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'reno', '那就是别的什么虫，反正咬了我好几口。'),
      T('罗文趁隙发难！没有预兆，短杖顶端那圈冰蓝的环骤然裂开，一线黑光越过雷纳德直奔我心口！叔叔脚尖一勾，碎石板斜飞挡在我面前，整块石头从中间被腐蚀出一个冒烟的洞！', { sfx: 'magic', portraits: [] }),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'reno', '偷袭一个八岁小孩——你这个侍卫当得确实挺有想法。'),
      {
        text: '叔叔抬脚踩地，松软的泥土翻涌扣住罗文脚踝，歪斜的石碑随之倾倒切出窄道——此刻是否亲自进入乱葬岗活捉战？',
        choices: [
          {
            text: '趁势施放蔓地薄冰与两道冰壁夹杖，直接收网活捉',
            lines: [
              T('罗文炸开土层穿过石碑窄道，却迎面撞上叔叔等在出口的一掌！他横杖格挡向后滑出数步，脚下正好踩上我刚才铺开的薄冰，重心骤偏！', { sfx: 'magic', portraits: [] }),
              T('冰层沿小腿向上冻结，叔叔抓住他慢了半步的空隙按肩灌入土系魔力，几道石棱破土卡住他的膝弯、手肘和后背！罗文反手虚刺叔叔肋下，短杖却脱手旋飞直取我面门！'),
              MONO('sylvia', 'serious', '又是偷袭，我早有准备！两道冰壁在半空合拢死死夹住嗡鸣的短杖，石棱随之彻底闭合。他刚抬起右手，一根冰锥便钉穿袖口将手摁在土面上——钉的是袖口，皮肉分毫没碰。'),
            ],
          },
          {
            text: '与雷纳德并肩出战（进入「乱葬岗活捉罗文」4星实战）',
            lines: [
              { battle: { stageId: 'rowan_graveyard', usePreset: true, fullRestore: true } },
              T('随着最后一道石棱闭合、两道冰壁在半空夹住旋转袭来的短杖，我掷出一根冰锥钉穿罗文袖口将他右手摁在土面上——皮肉分毫没碰，留着问话。', { bg: 'bg-img-night bg-night', portraits: [] }),
            ],
          },
        ],
      },
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '挺客气。', { bgm: 'emotional' }),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'sylvia', '留着问话。'),
      T('罗文挣了一下，石棱纹丝不动。得知我出门前便经由府中其他侍卫联系了雷纳德叔叔，他终于闭了闭眼——这大概是整件事里，他头一回真正算错。', { bg: 'bg-img-night bg-night', portraits: [] }),
      DIM(['sylvia', '希尔维亚'], ['reno', '雷纳德'], '叔叔蹲下来，把那根短杖从碎冰里捡起，翻来覆去看了看。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '「静止的日蚀」——《传说魔杖考》里排得上号的东西。用它施展的魔法，护甲也好屏障也好一概拦不下，方才全亏石板够厚，替你挡下了那要命的一击。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '所以，你到底怎么发现他不对劲的？'),
      MONO('sylvia', 'normal', '真实答案是四段冻结的记忆、天文台没有预告的日蚀，以及罗文比身体慢了半拍的影子。这些当然不能说。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'sylvia', '马尔科不可能知道我的路线，罗文却知道。袭击开始前他喊的是「低头」，提前知道头一击会越过塞姆直取我的头；而且他杀得太快，更像在灭口。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '你就凭这些，让人给我塞张写着「别问、跟着、等我先动手」的纸条，叫我半夜来乱葬岗？你给自家叔叔安排得明明白白啊。'),
      DUO(['sylvia', '希尔维亚', 'smile'], ['reno', '雷纳德'], 'sylvia', '你不还是来了吗？'),
      DUO(['sylvia', '希尔维亚', 'smile'], ['reno', '雷纳德'], 'reno', '谁让你是我侄女。'),
      T('他把杖往肩上一扛站起身，什么也没有再追问。远处传来马蹄声，叔叔事先安排的人到了。罗文被带走时经过我身边，脚步停了一下。', { portraits: [] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐，如果当初我先告诉您，结果会不一样吗？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '会。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '您会留下我？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '不知道。但塞姆会活着。' },
      T('罗文没有再说话，任由押解的队列没入夜雾。', { portraits: [] }),

      // —— 第六幕：尾声·拆卷结案与移交保管「静止的日蚀」 ——
      T('四桩案子后来被重新拆开：前三桩归罗文，第四桩归马尔科。文书官按我那张纸翻了半宿，在料箱最底找到了双齿冲子，又在老板卧室床板底下找出了马尔科甚至没翻到的真账本。', { bg: 'bg-img-study bg-study', loc: 'study', bgm: 'relax', portraits: [] }),
      T('被带走的更夫放了出来。卡尔保住了手臂，塞姆的名字被深深刻进公爵府护卫厅纪念墙，他兜里剩下的饴糖由卡尔分给了新来的年轻人。真相公开后，蒜和银器的价钱总算慢慢落了回去。'),
      T('书房里，父亲问我为什么擅自夜里出城。我说，是叔叔带我去的。叔叔在旁边看了我一眼，面不改色地点头。'),
      DUO(['claude', '父亲'], ['reno', '雷纳德'], 'reno', '对，我带的。'),
      DIM(['claude', '父亲'], ['reno', '雷纳德'], '父亲罚他抄了好几遍公爵府夜间出行规章，我全身而退——这大概就是有叔叔的好处。'),
      T('至于「静止的日蚀」，它作为证物被封进了公爵府地下库房。雷纳德叔叔把封存文书递给我时，特意用手指敲了敲那只黑色匣子。', { portraits: [] }),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '这东西最好永远别再拿出来。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'sylvia', '嗯。'),
      T('当时的我也是这么想的。不过，所谓「永远」，通常都没有想象中那么长。入冬前库房清点证物，我替忙不过来的文书官跑了趟地下。', { portraits: [] }),
      T('黑匣子打开，深蓝的杖身上那圈冰蓝细环还在无声地转，环心的黑核纹丝不动。提示音落下的刹那，系统压根没跟我商量，直接把短杖收进了背包。'),
      MONO('sylvia', 'normal', '我在登记簿上写下：证物「静止的日蚀」，移交保管。能挪动月影的效果一，因为我无法把魔力作用到月亮，确实用不了；但让魔法伤害转为真实伤害的效果二嘛……快入冬了，这根短杖的气质，和冬天还挺搭。', {
        flag: 'ch_interlude_white_night',
        do: () => {
          if (_interludeSaved) {
            S.ageY = _interludeSaved.ageY;
            S.phase = _interludeSaved.phase;
            S.loc = _interludeSaved.loc;
            _interludeSaved = null;
          } else {
            S.ageY = Math.max(S.ageY, 8);
            if (LOCS.study) LOCS.study.unlock = true;
            S.loc = 'study';
          }
          updateHUD();
        },
        freeRoam: true,
      }),
    ],
  };

  global.STORY_VOL4_CHAPTERS = STORY_VOL4_CHAPTERS;
  global.STORY_VOL4_SCENES = SCENES;
})(typeof window !== 'undefined' ? window : globalThis);
