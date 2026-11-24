/* =========================================================
   转生千金 · 间章《白昼里的夜》原著实装剧本
   由 game.js 的 mergeStory() 合并入 SCENES 与 STORY_CHAPTERS
   ========================================================= */
(function (global) {
  'use strict';

  const STORY_VOL4_CHAPTERS = [
    { id: 's_interlude_white_night', vol: '间章', title: '间章·白昼里的夜', phase: 'youth' },
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
  // 间章《白昼里的夜》（6岁→7岁→8岁 · 晦轮杖与月影迟滞）
  // =========================================================================
  SCENES.s_interlude_white_night = {
    bgm: 'sad',
    bg: 'bg-img-forest bg-forest',
    loc: 'road',
    useOriginalSylvia: true,
    card: { vol: '间章', t: '间章', s: '白昼里的夜' },
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
      T('六岁那年，雷纳德叔叔离开公爵府没过多久，城西林道旁边出现了一具无名尸首。', { bg: 'bg-img-forest bg-forest', loc: 'road', portraits: [] }),
      T('我原本只是乘车去看那一带新挖的引水渠。父亲答应过，等水渠通水，便把南花园那块半枯的草坪重新翻种。'),
      T('贝阿特丽丝姐姐为此提了不少意见，比如种满火红花丛，再竖一座跟她一般高的石像——父亲最终只采纳了前半句。'),
      T('马车停在林道边时，先一步探路的侍卫骤然喊出声，紧接着大步挡到我身前，似乎只要脊背绷得够直，后方的死人就会凭空消失。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '侍卫', text: '二小姐，请先回马车里歇着！' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '已经看见了。' },
      T('空气一时有些僵住。另一名年轻侍卫从灌木后走了出来，单膝跪在潮湿草地上查看尸首——深褐色短发，相貌寻常，眼神却异常沉定。', { portraits: [] }),
      MONO('sylvia', 'normal', '后来我才知道，他叫罗文。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '是个赶马车的车夫，断气少说有一整夜了。颈侧有伤，衣兜里也没剩值钱物件。' },
      T('他语速舒缓，全无刻意敷衍孩童的意思。身旁同僚轻咳一声，暗示这里还站着个六岁小姑娘。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐会害怕吗？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '还好。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '那也别盯着看太久。' },
      T('他起身站定，恰到好处地替我遮住了视线。不过那一眼已经够我看清：死者面色白得吓人，颈侧并排留着两处极近的小孔，脚上却套着一双干干净净的皮靴。', { portraits: [] }),
      MONO('sylvia', 'normal', '昨夜落过一场透雨，西边林道满是湿泥。一个自己踏进灌木丛的人，靴底绝不会这般洁净。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '他原本倒在别处，死后才被人搬来这里。' },
      T('几名侍卫闻言齐齐转头看我。罗文也垂眸扫了一眼尸首鞋底。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐怎么看出来的？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '泥渍。鞋底太干净了。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '也许他绕过水洼，从另一侧林地穿过来。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '另一侧全长满带刺荆棘，他的裤脚却完好无损。' },
      T('罗文在灌木边沉默片刻，随后嘴角微扬——全无哄逗幼童的夸张腔调，只像遇到一件意料之外的趣事。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐眼光真准，也记得真清。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '刚才顺眼瞧见的罢了。' },
      T('他差人护送我回马车，自己留下来配合封锁现场。这桩命案最终按低阶魔兽袭人草草结卷，验尸官将纸般的惨白面色归咎于失血过多。', { portraits: [] }),
      T('分开听句句合乎常理，拼在一起却处处透着勉强。可我那时才六岁——公爵千金若对死尸追根究底，母亲会悬心，姐姐还会扛着木剑在庭院四处巡查，平白惊动满府。'),
      T('于是我什么也没再问。唯有一则古怪风声自城西酒馆悄悄传开：暗夜里行凶的，兴许是某种嗜血的邪物。'),

      // —— 第二幕：七岁·旧磨坊、奶油蛋糕与长廊问询 ——
      T('转眼到了七岁，旧磨坊里发现了第二具尸首——死者是地下赌坊的收债打手，双手交叠靠墙而坐，颈侧依旧留着两处小孔，周围却几乎不见血迹。', {
        bg: 'bg-img-dining bg-hall',
        loc: 'dining',
        bgm: 'peaceful',
        portraits: [],
        do: () => { S.ageY = 7; updateHUD(); },
      }),
      T('同样的流言很快从酒馆飘进市集，连公爵府午后茶点时间也有人提起。当「吸血鬼」三个字第一次落进餐厅时，贝阿特丽丝姐姐正往嘴里送一块厚厚的奶油蛋糕。'),
      N('她当场被呛得睁大双眼，端起红茶连咳了好几声。', [['beatrice', 'center', 'surprised']]),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'surprised'], 'beatrice', '咳、咳咳——咱们领地里居然冒出吸血鬼了？！'),
      DUO(['claude', '父亲'], ['beatrice', '贝蒂', 'serious'], 'claude', '不过是街巷捕风捉影的传闻，莫要大惊小怪。'),
      DUO(['claude', '父亲'], ['beatrice', '贝蒂', 'serious'], 'beatrice', '那也绝不能大意呀！它要是敢溜进公爵府，我立刻施放火系魔法把它烤成炭灰！'),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'serious'], 'sylvia', '……姐姐，你先把奶油擦掉再发表战前宣言吧。'),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'surprised'], 'beatrice', '哎？沾在哪儿啦？'),
      DUO(['sylvia', '希尔维亚'], ['beatrice', '贝蒂', 'surprised'], 'sylvia', '鼻尖上。'),
      N('坐在一旁的爱丽丝没出声，乖巧地把折叠方正的棉手帕递到姐姐手边。父亲望着我们姐妹三人轻揉眉心，次日还是命人加强了城内巡防。', [['alice', 'center', 'normal']]),

      T('也从那段时日起，罗文成了我外出时的常任随行侍卫。他做事妥帖利落：我想看书便替我挑好遮光的车帘角度，姐姐想翻墙溜出门，他总能提前一步守在墙外等着。', { bg: 'bg-img-hallway bg-hall', loc: 'hallway', bgm: 'sad', portraits: [] }),
      T('旧磨坊的案子查了好一阵子仍无头绪。王都派来核对卷宗的问询骑士登门查问第一桩案情，因我曾亲眼见过尸首，便在长廊偏厅多问了几句。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '问询骑士', text: '二小姐，还记得当时天气与死者衣着么？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '前夜落过雨，晨起已停，林道东侧白桦枝叶还在滴水。死者穿灰褐色短外套，左侧第二颗纽扣裂了道缝，旧牛皮腰带扣错了一格，右手食指沾着墨痕。' },
      T('骑士捧着羊皮笔录反复翻看，额角微微冒汗。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '问询骑士', text: '……卷宗里只草草记着「灰色外套」。您确信那是去年瞧见的那一具？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '我只见过那一具，卷宗缺了便补上吧。' },
      T('守在门畔的罗文全程一言未发。等骑士收卷告辞，他才上前替我推开长廊木门，神色一如既往地平和。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐的记性，比我预想的还要惊人。连一年前衣扣上的细裂都分毫不差。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '裂纹长得像条小鱼，顺便就记住了。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '原来如此。' },
      T('他点了点头，没有再追问。可我心里明白，从那扇廊门之后，罗文牢牢记住了一件事——但凡落入我眼里的细节，都不会轻易消散。', { portraits: [] }),
      T('第二桩案子终究不了了之。两名死者生前皆涉灰色行当，既无亲眷也无往来，传闻便暂且蛰伏在了夜色里。'),

      // —— 第三幕：八岁·冰晶宫殿觉醒、模仿案与白昼日蚀 ——
      T('八岁这一年，我晋升为中级魔法师，意识深处也筑起了用以封存画面的「冰晶宫殿」。没过多久，城南又传出第三桩命案——死者是替黑市伪造路引的掮客。', {
        bg: 'bg-img-parlor bg-hall',
        loc: 'parlor',
        bgm: 'sad',
        portraits: [],
        do: () => { S.ageY = 8; updateHUD(); },
      }),
      T('三起手法如出一辙的悬案惊动了王都。由骑士、治愈师与文书官组成的调查组进驻领地，将三份尸检记录一字排开，却始终找不到任何嫌疑人的踪迹。'),
      T('罗文依旧安稳地随行在我身后，替护卫队递送文书，在姐姐企图从厨房窗口偷溜时准时撤掉木梯。满府上下都将他视作最省心妥帖的年轻护卫，谁也没往他身上起过半分疑心。'),
      T('直到没隔几天，第四桩命案打破了僵局——城南皮具店的老板倒在工作间里，颈侧两孔惨白，街巷流言顿时沸腾，市集上的大蒜与银饰一夜间身价陡涨。'),
      N('清早推开房门时，门环上赫然挂着一大串气味冲鼻的白皮蒜，贝阿特丽丝姐姐正叉腰站在廊下得意洋洋。', [['beatrice', 'center', 'normal']]),
      DUO(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], 'beatrice', '喂，爱丽丝，干嘛把那串蒜摘下来呀！那可是防吸血鬼的护身符！'),
      DUO(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], 'alice', '……姐姐大人嫌味道太冲，而且午饭炖汤，厨房刚好缺蒜头。'),
      DIM(['beatrice', '贝蒂'], ['alice', '爱丽丝', 'normal'], '姐妹俩在门外无声对望片刻，最终那串大蒜还是乖乖回了厨房。'),
      T('王都调查组顺理成章地将四桩命案并作一案侦办。可我去店外核看卷宗抄件与现场证物后，很快觉察出第四桩案情另有蹊跷。', { portraits: [] }),
      MONO('sylvia', 'serious', '前三具尸首的颈伤边缘均有极浅淤痕；唯有皮具店老板颈上的两处小孔边缘规整带角，分明是金属器械硬压出来的。'),
      MONO('sylvia', 'normal', '工作台上那把双齿冲子恰好一长一短，深浅与伤口严丝合缝。每逢有人追问账目与冲子，学徒马尔科的右手拇指总会下意识摩挲左手虎口。'),
      T('顺着床板暗格里的真账本与排水沟缝隙卡住的围裙碎布，真相水落石出：马尔科私吞货款败露，杀害东家后企图借吸血鬼流言混淆视听。', { portraits: [] }),

      T('我将全部推理细节抄录成信笺折好，挑了个晴朗正午动身送往调查组驻地。随行侍卫共有三人：罗文，以及老资历的塞姆与卡尔。', { bg: 'bg-img-town bg-town', loc: 'town', bgm: 'peaceful', portraits: [] }),
      T('前面街口被运货板车堵死了去路，我不想在车厢里枯等，便下车带着三名侍卫步行穿过长街。刚走到街心——天光骤然熄灭！'),
      T('天空并无阴云遮蔽，炽烈的白日却像被无形巨口吞去大半，暗影从长街两端疾卷而来！商铺魔灯尚未点亮，惊叫与板车翻倒声瞬间炸作一团。', { bg: 'bg-void', bgm: 'battle', sfx: 'bad', portraits: [] }),
      MONO('sylvia', 'surprised', '日蚀？！卡萨天文台今晨的公告明明写着全天晴朗无风，今日天象里压根没有日蚀！'),
      T('念头方起，一道瘦削苍白的黑影自屋檐凌空扑下！他嘴角挂着暗红血迹，两颗尖长犬齿外露，失焦的双眼死死锁住我，直扑面门！', { portraits: [] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'surprised', active: false }], speaker: '罗文', text: '低头！！' },
      T('塞姆抢先一步横剑格挡！一声令齿根发酸的脆响过后，精钢长剑竟被徒手折断，塞姆胸口遭利爪洞穿，整个人重重撞上砖墙！', { sfx: 'bad', portraits: [] }),
      T('卡尔从侧翼挥刃斩去，袭击者头也没回便反手扣住他手腕狠狠一拧，骨裂声脆得刺耳。一切只在电光火石间发生！'),
      MONO('sylvia', 'serious', '我无暇细想，抬手施放冰墙挡下扑击！暗影骤降那一瞬我已凝起第一面冰镜封存视野，此刻第二面冰镜同时冻结——袭击者的苍白指尖卡在龟裂的冰壁间！'),
      T('罗文自右后侧疾掠而出，剑锋并未格挡利爪，反倒刁钻地直刺袭击者心口！我本能冻下第三面冰镜——对方挣扎回眸，露出的赫然是学徒马尔科的脸！', { portraits: [] }),
      T('罗文抽剑连刺，丝毫不给对方喘息之机。就在他收势的一瞬，日蚀戛然而止，阳光如揭开黑布般重新洒满长街！', { bg: 'bg-img-town bg-town', bgm: 'sad', portraits: [] }),
      T('罗文立刻丢下滴血的长剑转身护在我身侧。我下意识冻结了第四面冰镜。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐，没伤着吧？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '我没事。' },
      T('塞姆当场殉职，卡尔右臂重伤未卜。凶恶的「吸血鬼」现身白昼又被护卫罗文当街诛杀，延续数载的恐慌仿佛终于画上句点。', { portraits: [] }),
      T('父亲亲自嘉奖了拼死护主的罗文，王都调查组也准备结案返程。街坊与护卫队交口称赞，觉得今后二小姐外出只需带上机警过人的罗文便足矣。连白日的我，也曾有片刻松懈。'),

      // —— 第四幕：冰晶宫殿推演板 · 月影迟滞与晦轮杖铁律 ——
      T('直到夜深人静，我独坐房中重新展开那张未送出的推理信笺，心底那缕违和感才陡然浮上水面。', { bg: 'bg-img-ownroom bg-night', loc: 'ownroom', bgm: 'sad', portraits: [] }),
      MONO('sylvia', 'serious', '马尔科确是第四案真凶，可我从未提前传信，他绝无可能料到我会在正午徒步走那条长街。知晓我行踪的唯有三名侍卫——殉职的塞姆、昏迷的卡尔，以及罗文。'),
      T('我合上双眼，将意识沉入静谧寒冷的「冰晶宫殿」。长廊尽头，白日仓促封存的四面冰镜正泛着微光悬在半空。', {
        bg: 'bg-void',
        bgm: 'sacred',
        portraits: [],
        do: () => {
          if (isInteractiveBrowser() && window.AmbientFX && typeof window.AmbientFX.openDeductionBoard === 'function') {
            try {
              window.AmbientFX.openDeductionBoard({
                title: '冰晶宫殿 · 寒夜冰镜推演',
                subtitle: '冻结白昼四幅画幕，比对《传说魔杖考》旧典，锁定唤来异常日蚀的施术者',
                prompt: '请点选能够直接交叉印证施术者破绽的两项核心证物：',
                clues: [
                  { id: 'mirror_1', label: '画幕·其一 · 正午日蚀', detail: '天文台公告全天晴朗，长街正午却突降无云日蚀，显系人为术式所致。', isKey: false },
                  { id: 'mirror_3', label: '画幕·其三 · 血傀之影', detail: '血傀马尔科回身刹那，脚下影子与躯体严丝合缝，毫无半拍迟滞。', isKey: false },
                  { id: 'mirror_4', label: '画幕·其四 · 迟滞月影', detail: '阳光重落街面时，罗文已松剑扶住我肩侧，地面影子却仍握着剑慢了半拍！', isKey: true },
                  { id: 'book_staff', label: '藏书室 · 《传说魔杖考》', detail: '晦轮杖仅借已达月轮之魔力挪动月影天光；术止后施术者之影迟于其身半拍，直至下次月升。', isKey: true },
                ],
                requiredIds: ['mirror_4', 'book_staff'],
                conclusion: '真相锁死：白昼之前无人怀疑过罗文，唯有第四面冰镜里慢了半拍的影子，与《传说魔杖考》红墨注脚严丝合缝——唤来白昼黑夜的施术者，正是随行侍卫罗文！',
                skipLabel: '略过推演 · 直通下文',
              });
            } catch (e) {}
          }
        },
      }),
      {
        text: '四面冰镜静悬在霜蓝长廊里，该先细察哪一处异样来拆穿这场白昼日蚀？',
        choices: [
          {
            text: '定格第四面镜影：日光重落时，罗文脚下影子仍握剑慢了半拍',
            do: () => { addStat('mind', 2); flag('deduced_moon_shadow_lag', 1); },
            lines: [
              MONO('sylvia', 'surprised', '我的呼吸猛地一滞！第四面镜影里，罗文抬起的右手已经松开剑柄停在我肩侧——可他身后的地面影子，却仍旧维持着握剑下刺的姿态，整整慢了半拍！'),
              MONO('sylvia', 'serious', '我又退回第三面画幕核验：马尔科转身时影子与身形完全重合，毫无迟滞。制造日蚀的凶手另有其人——从头到尾，全领地此前从未有人怀疑过罗文，而此刻，我是第一个看穿他的人。'),
            ],
          },
          {
            text: '比对第三面与第四面画幕：核查血傀与侍卫落在地面的影子轨迹',
            do: () => { addStat('mind', 2); flag('deduced_moon_shadow_lag', 1); },
            lines: [
              MONO('sylvia', 'serious', '第三面画幕中，马尔科扭头的一瞬，影子分毫不差地贴着鞋跟转动；可切回第四面镜影，罗文分明已丢剑转身，脚下影子却还滞留在握剑的旧动作里！'),
              MONO('sylvia', 'surprised', '那半拍的延迟在白昼混乱里短得像日光晃眼，却逃不过冰晶宫殿的封存画面——所有人都将罗文奉作救主功臣，我成了第一个起疑的人。'),
            ],
          },
          {
            text: '调取藏书室旧存档：翻查《传说魔杖考》里被红墨圈注的条目',
            do: () => { addStat('mind', 1); addStat('mana', 1); flag('deduced_moon_shadow_lag', 1); },
            lines: [
              MONO('sylvia', 'serious', '我快步走向另一条回廊，调出前些日子在公爵府图书室封存的《传说魔杖考》书页，再转头比对第四面镜影——罗文身后那道慢了半拍的影子，正与红墨注脚严丝合缝！'),
              MONO('sylvia', 'surprised', '白昼里无人对这位温润守礼的侍卫存过一丝疑心，直到这半拍错位的月影落进我眼里，整条暗线才头一回露出了獠牙。'),
            ],
          },
        ],
      },
      T('我停在藏书室那面旧镜前，逐字读清《传说魔杖考》里关于「晦轮」短杖的记载。', { bg: 'bg-img-study bg-study', loc: 'study', portraits: [] }),
      MONO('sylvia', 'serious', '书中明言，发动日蚀的条件有且只有一条：使用者自身原本就能把少量魔力作用到月亮。晦轮杖仅能挪动业已落在月轮上的那点魔力、借此偏移月影与天光，它本身绝无法替人把魔力送往苍穹银盘。'),
      MONO('sylvia', 'normal', '换言之，像我这样不具备这份天赋的魔法师，即便日后把晦轮杖握在手里，也绝无可能借它唤来日蚀。而书页末尾的红墨小字更如针刺目——'),
      T('「借月影者，月影亦借其身。术止之后，施术者之影将迟于其身半拍，直至下一次月升。」'),
      T('我退出冰晶宫殿，推窗望向夜空。一轮冷月正自东方缓缓升起，此刻罗文的影子，想必早已恢复如常了。', { bg: 'bg-img-ownroom bg-night', loc: 'ownroom', portraits: [] }),

      // —— 第五幕：西郊乱葬岗对峙、雷纳德登场与可选活捉战 ——
      T('无人愿认领一具所谓「吸血鬼」的尸首，当天下午马尔科便被无标记板车草草埋去了西郊乱葬岗。入夜后，我独自踏入薄雾弥漫的荒冢。', { bg: 'bg-img-night bg-night', loc: 'road', bgm: 'sad', portraits: [] }),
      T('新土与旧土温差迥异。我抬手施放一层极薄寒霜漫过草地，冰面很快在某处微微凹陷下去。费了好一番气力掘开浮土，我凝起细冰针逐一刺入马尔科手臂、颈侧与心口。'),
      MONO('sylvia', 'serious', '四肢与颈脉干涸无血，唯独心口针尖沾着一丝淡得发透的暗红——真正血族死后心脉犹存本源血，唯有被强行催动的血傀才会燃尽自身精血，耗空后只余一副空壳。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '我就知道，二小姐一定会来。' },
      T('低沉平和的嗓音自身后响起。我拍净裙摆浮土转过身——歪斜墓碑的阴影里，罗文换了一身利落黑衣，右手握着一柄短黑魔杖，杖顶嵌着一圈暗银细环，恰如被吞噬的冷月。', { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '晦轮杖。前面三桩案子，全是你动的手。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '是。马尔科本来就杀了东家，我只不过先一步查清了真相，咬了他，再请他在白昼里替我演完这场收尾戏。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '你担心我交出第四案的证据后，调查组会把前后案卷拆开重查，顺藤摸瓜查到前三桩命案的破绽。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '二小姐向来聪慧。只要一个真正的「吸血鬼」当众袭主又死在我的剑下，所有传闻与追查都会彻底终止，今后您出门也只需带我一人便好。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '那塞姆的命呢？卡尔险些废掉的手臂呢？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '血傀失控实属意外。可这场袭击必须足够逼真，旁人才会深信不疑。只要您答应像从前一样信任我，我会替您扫清一切藏在暗处的隐患，绝不伤害公爵府任何亲眷。' },
      MONO('sylvia', 'serious', '夜雾在荒冢间无声流淌。此刻我年仅八岁，面前站着活了不知多少载的血族，离最近的巡逻道隔着好一段路程。先虚与委蛇，似乎才是稳妥之举。'),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '想活下去没有错，怕被人撞破身份也没有错。哪怕第一桩案子后你向我坦白，我或许都会替你另寻生路。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '可你为了证明自己值得信赖，先让信赖你的同僚丢了性命；为了证明自己无可替代，先毁掉身边所有能替代你的人。' },
      T('薄冰自鞋底悄然铺开，数道锋锐冰刃在冷月下瞬间成形。', { sfx: 'magic', portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '这样的守护我承担不起——守护，成不了杀人的免罪符！' },
      T('三道冰刃破雾疾射！罗文速度远胜白昼，反手挥杖震碎合拢的冰墙，身形如烟掠至我跟前，苍白五指停在离我咽喉寸许之处，我后跟撞上冰冷墓碑退无可退。', { bgm: 'battle', sfx: 'bad', portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: false }], speaker: '罗文', text: '您明知不该独自前来，为何还要踏进这里？' },
      N('高处歪脖子树梢忽然落下懒洋洋的嗓音。雷纳德叔叔像只嫌树枝太细的大鸟般蹲在枝杈间打了个哈欠，轻巧纵身跳进雾里。', [['reno', 'center', 'normal']]),
      DUO(['sylvia', '希尔维亚', 'serious'], ['reno', '雷纳德'], 'reno', '因为她从出门前，就压根没打算单枪匹马啊。一个人查案，一个人赴约，临开打还得念两句漂亮台词——侄女，你的主角瘾过够了没有？'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'sylvia', '差不多了。再晚来半拍，我就要当你蹲在树上睡着了。'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'reno', '要求真高，我在树枝上喂了好一阵蚊子呢。'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'sylvia', '现在早已入秋了。'),
      DUO(['sylvia', '希尔维亚', 'normal'], ['reno', '雷纳德'], 'reno', '那就是别的什么虫子吧——喂，偷袭八岁小孩的侍卫先生，动真格前可别忘了家长就在旁边站着。'),
      T('话音刚落，晦轮杖顶的暗银细环陡然迸出一线黑光越过雷纳德直取我心口！叔叔脚尖轻勾，一块碎石板应声斜飞挡下黑光，泥土翻涌化作石墙将乱葬岗切作窄道！', { sfx: 'magic', portraits: [] }),
      {
        text: '雷纳德已用土系魔法封出窄道，须留活口问案——此刻是否亲自进入乱葬岗活捉战？',
        choices: [
          {
            text: '依原著节拍施放蔓地薄冰与双镜夹杖，直接收网活捉',
            lines: [
              T('罗文被倾倒的墓碑逼入窄道，迎面撞上雷纳德沉稳一掌向后滑步——鞋底恰巧踩上我早先铺就的无声薄冰，重心骤偏！', { sfx: 'magic', portraits: [] }),
              T('冰霜顺他小腿疾冻而上，叔叔紧接着按肩灌入土系魔力，四道石棱破土而起卡死他全身关节。罗文反手虚刺叔叔肋下，暗黑短杖却在半途脱手旋飞直袭我眉心！'),
              MONO('sylvia', 'serious', '我早料到这记偷袭！两面厚实冰镜在半空凌空合拢，死死夹住剧烈嗡鸣的晦轮杖，紧接着一根冰锥精准钉穿他袖口，将他右手牢牢固定在离地半寸处！'),
            ],
          },
          {
            text: '与雷纳德并肩出战（进入「乱葬岗活捉罗文」4星实战）',
            lines: [
              { battle: { stageId: 'rowan_graveyard', usePreset: true, fullRestore: true } },
              T('随着最后一道石棱闭合、两面冰镜凌空锁死旋转袭来的晦轮杖，我顺手掷出一根冰锥钉穿罗文袖口，将其稳稳制伏在荒冢泥地上。', { bg: 'bg-img-night bg-night', bgm: 'sad', portraits: [] }),
            ],
          },
        ],
      },
      T('挣扎无果的罗文终于闭上眼，这是整盘布局里他头一回真正失算。雷纳德从碎冰里拾起晦轮杖端详片刻，扭头望向我。', { bg: 'bg-img-night bg-night', bgm: 'sad', portraits: [] }),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '说吧，你到底是怎么察觉他不对劲的？'),
      MONO('sylvia', 'normal', '真正的答案是冰晶宫殿里的四面冰镜、天文台未曾预告的日蚀、红墨注脚，以及慢了半拍的影子。可这些底牌不能说出口。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'sylvia', '马尔科无从得知我的午间路线，罗文却一清二楚。况且袭击前他先喊的是「低头」——他提前知道扑击会越过塞姆从头顶落下，事后又急着灭口，生怕旁人细验尸首。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '就凭这些，塞张只写着「别问、跟着、等我先动手」的纸条把我叫来荒郊野岭？你也太会支使自家叔叔了。'),
      DUO(['sylvia', '希尔维亚', 'smile'], ['reno', '雷纳德'], 'sylvia', '可叔叔还是照着来了。'),
      DUO(['sylvia', '希尔维亚', 'smile'], ['reno', '雷纳德'], 'reno', '谁让你是我侄女呢。'),
      T('远处传来急促马蹄声，叔叔事先调来的亲信赶到了。罗文被押解着经过我身旁时，脚步轻轻顿了一下。', { portraits: [] }),
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '二小姐……如果当初我先向您坦白，结局会有所不同吗？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: true }], speaker: '希尔维亚', text: '会的。' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'normal', active: false }], speaker: '罗文', text: '您会留我在身边？' },
      { portraits: [{ id: 'sylvia', slot: 'left', emo: 'serious', active: true }], speaker: '希尔维亚', text: '我不知道。但塞姆至少还活着。' },
      T('罗文再没说一个字，任由锁链牵引着没入深沉夜雾。', { portraits: [] }),

      // —— 第六幕：尾声·封存晦轮杖 ——
      T('四桩命案随后被重新拆卷结案：前三桩归于罗文，第四桩归于马尔科。卡尔保住了右臂，塞姆的名字刻上了护卫厅纪念墙，城里的大蒜与银价总算慢慢回落。', { bg: 'bg-img-study bg-study', loc: 'study', bgm: 'relax', portraits: [] }),
      T('书房里，父亲沉声追问我为何擅自夜行出城。我面色如常地指向身旁，说是叔叔带我出去散心。'),
      DUO(['claude', '父亲'], ['reno', '雷纳德'], 'reno', '没错，是我带她出去的。'),
      DIM(['claude', '父亲'], ['reno', '雷纳德'], '父亲盯了他半晌，罚雷纳德将公爵府夜间出行规章工工整整抄写三遍，而我毫发无伤地免了罚——有这样一个靠得住的叔叔，确实省心不少。'),
      T('至于那柄黑木嵌银环的晦轮杖，很快便作为要案证物装进黑木匣，封存入公爵府最深处的地下库房。', { portraits: [] }),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'reno', '封存文书拿好。这东西诡异得很，最好永远都别再重见天日。'),
      DUO(['sylvia', '希尔维亚'], ['reno', '雷纳德'], 'sylvia', '嗯。'),
      MONO('sylvia', 'normal', '何况我本就无法把魔力触及高天明月，就算某天将它取出来握在掌心，也绝无可能借它招来白昼里的黑夜。当时的我也盼着它永远沉睡在黑匣里——只是世间所谓「永远」，往往远比想象中短暂。', {
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
