/* =========================================================================
   转生千金 · 道具实绘资产统一注册表 (ItemArtRegistry)
   收录板 A 定稿全部 31 件高画质透明 WebP（assets/items/{id}.webp）
   零外部依赖 · 纯 IIFE · 同步兼容浏览器 window 与 Node/JSDOM module.exports
   ========================================================================= */
(function (root) {
  'use strict';

  var BASE_PATH = 'assets/items/';

  var ORDER = [
    'eclipse_wand',
    'north_saint_staff',
    'ice_pebble',
    'blue_vial',
    'alice_flower_cake',
    'noelle_manuscript',
    'shell_pin',
    'belmont_schedule',
    'cross',
    'ebony_sword',
    'frost_cipher',
    'aino_academy_handkerchief',
    'aino_frost_shard',
    'northwind_pass',
    'cookie',
    'noelle_errata',
    'belmont_challenge',
    'shop_caramel_cookie',
    'shop_mint_tea',
    'shop_honey_pancake',
    'shop_osmanthus_cake',
    'shop_parchment_journal',
    'shop_ice_bookmark',
    'shop_sword_tassel_oil',
    'shop_polar_lily_dried',
    'shop_frost_cedar_sachet',
    'shop_silver_moon_clip',
    'shop_magic_theory_notes',
    'shop_warming_frost_stone',
    'alice_letter',
    'peilin_note'
  ];

  var ITEMS = {
    eclipse_wand: {
      id: 'eclipse_wand',
      name: '晦轮杖',
      category: 'staff',
      rarity: 'legendary',
      src: BASE_PATH + 'eclipse_wand.webp',
      desc: '外层黑曜星环嵌合冰晶棱芯的法杖。最大魔力 +24%，施法视作 100% 真实魔伤且无自创惩罚。',
      lore: '王都旧藏与秘闻交织的晦轮法杖，希尔维亚执握时绝不触发日蚀反噬。'
    },
    north_saint_staff: {
      id: 'north_saint_staff',
      name: '极北圣晶杖',
      category: 'staff',
      rarity: 'legendary',
      src: BASE_PATH + 'north_saint_staff.webp',
      desc: '极北寒晶雕琢的圣域法杖。法攻倍率 ×1.28、暴伤 +20%，增幅额外耗蓝降低 25%。',
      lore: '凝萃极北冻土终年不化之冰髓而成的白银圣杖，杖首六棱冰晶清辉凛然。'
    },
    ice_pebble: {
      id: 'ice_pebble',
      name: '冰蓝石子',
      category: 'relic',
      rarity: 'rare',
      src: BASE_PATH + 'ice_pebble.webp',
      desc: '公爵府花园拾得的寒凉小石。每回合首次【经手构筑】额外凝结 8 点寒霜护盾。',
      lore: '年幼时在公爵府花坛边拾得的冰蓝小石，握在掌心总是凉丝丝的，总能定神。'
    },
    blue_vial: {
      id: 'blue_vial',
      name: '淡蓝小瓶',
      category: 'relic',
      rarity: 'epic',
      src: BASE_PATH + 'blue_vial.webp',
      desc: '药神所赠晴空玻璃瓶。每场战斗首次生命跌破 35% 时回复 25% 最大生命并获 1 层风行残像。',
      lore: '如同装了一小块晴空的小玻璃瓶。瓶塞始终紧封，却在意识危殆时护住心脉。'
    },
    alice_flower_cake: {
      id: 'alice_flower_cake',
      name: '风之花饼',
      category: 'relic',
      rarity: 'rare',
      src: BASE_PATH + 'alice_flower_cake.webp',
      desc: '爱丽丝亲手烤制的蜂蜜花饼。每场战斗开局自带 1 层风行残像，残像闪避时额外回复 10 MP。',
      lore: '花瓣摆成笑脸的蜂蜜烤饼，风吹过饼屑时总像有人悄悄托住了衣袖。'
    },
    noelle_manuscript: {
      id: 'noelle_manuscript',
      name: '省魔手稿',
      category: 'relic',
      rarity: 'epic',
      src: BASE_PATH + 'noelle_manuscript.webp',
      desc: '诺艾儿并肩推演的魔导手稿。全魔法基础耗蓝降低 20%，开启魔力增幅时保留一半额外增幅魔力。',
      lore: '夹着橘猫胡须书签的推导手稿，每道水幕回路都算清了最省力的路径。'
    },
    shell_pin: {
      id: 'shell_pin',
      name: '月虹螺胸针',
      category: 'relic',
      rarity: 'rare',
      src: BASE_PATH + 'shell_pin.webp',
      desc: '三姐妹夏日礁石纪念胸针。水/风系攻击伤害 +18%，触发连携追击时额外回复 8% 最大 MP。',
      lore: '三姐妹并肩潜入海湾拾起的月虹螺，螺壳内侧至今留着淡淡的潮声虹彩。'
    },
    belmont_schedule: {
      id: 'belmont_schedule',
      name: '无名巡防抄件',
      category: 'relic',
      rarity: 'epic',
      src: BASE_PATH + 'belmont_schedule.webp',
      desc: '带着冷薄荷茶香的换防抄件。揭示敌方下回合架势倾向，全技能暴击率 +15%。',
      lore: '字迹工整如尺量的无署名抄件，将体面与傲气都藏进了分毫不差的刻度里。'
    },
    cross: {
      id: 'cross',
      name: '银十字架',
      category: 'relic',
      rarity: 'epic',
      src: BASE_PATH + 'cross.webp',
      desc: '海伦娜赠予的神殿银质信物。每回合结束回复 6% 最大生命，护盾技 +20% 护盾并净化 1 层负面状态。',
      lore: '希里昂见习生唯一的银质信物，在离校分别的礼堂前郑重放进掌心。'
    },
    ebony_sword: {
      id: 'ebony_sword',
      name: '乌木紫穗剑',
      category: 'relic',
      rarity: 'legendary',
      src: BASE_PATH + 'ebony_sword.webp',
      desc: '老霁与霁岚辞行相赠的百炼长剑。【霁馆剑步】暴击率 +25%、伤害 +15%，暴击返 1 AP 且零冰系暴露。',
      lore: '乌木鞘朴素沉稳，剑柄末端系着霁岚亲手编织的紫色蝶穗，陪着走过澄岚到塞北的长路。'
    },
    frost_cipher: {
      id: 'frost_cipher',
      name: '霜封暗记',
      category: 'relic',
      rarity: 'epic',
      src: BASE_PATH + 'frost_cipher.webp',
      desc: '公爵书房交托的银质联络暗徽。开启冰晶宫殿看破死角后，立即回复 18% 最大 MP 与 1 AP。',
      lore: '政变前夜暗流拼图合拢后留下的隐秘银徽，寒意沉静，总能在绝境中稳住呼吸。'
    },
    aino_academy_handkerchief: {
      id: 'aino_academy_handkerchief',
      name: '雪纹手帕',
      category: 'relic',
      rarity: 'epic',
      src: BASE_PATH + 'aino_academy_handkerchief.webp',
      desc: '艾诺留赠的赫兰六瓣冰纹亚麻帕。首回合首次【隔空瞬凝】免 1 AP，全冰系攻击伤害 +20%。',
      lore: '边角绣着六瓣赫兰冰纹的洁白亚麻帕，总带着雪后松林般的清冽寒意。'
    },
    aino_frost_shard: {
      id: 'aino_frost_shard',
      name: '钢冰试炼笺',
      category: 'relic',
      rarity: 'epic',
      src: BASE_PATH + 'aino_frost_shard.webp',
      desc: '艾诺凝结的零气泡薄冰铭牌。破招或卸力闪反后，下次冰系技无视 25% 法抗并附带寒颤。',
      lore: '没有半点气泡的通透薄冰片，内部凝着赫兰枪冰三式交错收束的发力轨迹。'
    },
    northwind_pass: {
      id: 'northwind_pass',
      name: '北风堡木牌',
      category: 'relic',
      rarity: 'rare',
      src: BASE_PATH + 'northwind_pass.webp',
      desc: '巴依药师团赠予的北境边关木牌。开局及每回合初获 12 点寒铁护盾，护送药箱额外减损 4 点。',
      lore: '凭恒温冰膜手艺护住军需药箱后赢得的边关木牌，木纹里浸着北地松脂与冷风气息。'
    },
    cookie: {
      id: 'cookie',
      name: '热饼干',
      category: 'consumable',
      rarity: 'common',
      src: BASE_PATH + 'cookie.webp',
      desc: '厨房刚烤出的温热小饼干，可随时在背包食用恢复 1 点体力。',
      lore: '「大小姐别告诉夫人，饭前吃点心要挨骂的。」刚出炉时焦香松软。'
    },
    noelle_errata: {
      id: 'noelle_errata',
      name: '精算勘误册',
      category: 'story',
      rarity: 'epic',
      src: BASE_PATH + 'noelle_errata.webp',
      desc: '字迹严整如尺的高阶防御术式勘误册，同步点亮【省魔手稿】铭记。',
      lore: '一笔一画算清所有骄傲与人情，每一条批注都直指回路损耗的症结。'
    },
    belmont_challenge: {
      id: 'belmont_challenge',
      name: '烫金战书羊皮笺',
      category: 'story',
      rarity: 'epic',
      src: BASE_PATH + 'belmont_challenge.webp',
      desc: '夏洛特离校前塞进书袋的约战书，同步点亮【无名巡防抄件】铭记。',
      lore: '火漆与金边皆不失贵族体面，字里行间傲气凛然，约期来日再见高低。'
    },
    shop_caramel_cookie: {
      id: 'shop_caramel_cookie',
      name: '焦糖黄油曲奇',
      category: 'shop',
      rarity: 'common',
      src: BASE_PATH + 'shop_caramel_cookie.webp',
      desc: '酥脆香甜的手工黄油小饼，咬下时溢开微暖焦糖余韵。自用：体力 +1、悠闲度 +8。',
      lore: '佐红茶与午后阳光最相宜的小铺招牌茶点。'
    },
    shop_mint_tea: {
      id: 'shop_mint_tea',
      name: '冰镇薄荷叶茶',
      category: 'shop',
      rarity: 'common',
      src: BASE_PATH + 'shop_mint_tea.webp',
      desc: '清冽回甘的精选薄荷茶包，冷泡热冲皆能瞬间提神醒脑。自用：魔力值 +14、悠闲度 +10。',
      lore: '带一丝冷冽清香的玻璃冷泡茶，令人联想起学院夏日的安静午后。'
    },
    shop_honey_pancake: {
      id: 'shop_honey_pancake',
      name: '蜂蜜松饼礼盒',
      category: 'shop',
      rarity: 'common',
      src: BASE_PATH + 'shop_honey_pancake.webp',
      desc: '淋着花蜜的松软厚松饼，用浅蓝丝带扎着淡雅纸盒。自用：体力 +1、悠闲度 +12。',
      lore: '切开时还冒着细软奶香，系着淡蓝缎带，适合送给最亲近的家人与挚友。'
    },
    shop_osmanthus_cake: {
      id: 'shop_osmanthus_cake',
      name: '澄岚桂花米糕',
      category: 'shop',
      rarity: 'common',
      src: BASE_PATH + 'shop_osmanthus_cake.webp',
      desc: '澄岚镇老铺现蒸的清甜米糕，撒满细碎金桂，温润饱腹。自用：体力 +2、悠闲度 +10。',
      lore: '温热米香裹着秋日金桂气息，带着澄岚镇街巷清晨的烟火温情。'
    },
    shop_parchment_journal: {
      id: 'shop_parchment_journal',
      name: '羊皮抄录本',
      category: 'shop',
      rarity: 'common',
      src: BASE_PATH + 'shop_parchment_journal.webp',
      desc: '纸页厚实匀净的随身手账本，用来记公式、日程或旅途见闻极顺手。自用：心智 +2、悠闲度 +4。',
      lore: '装帧素雅耐翻的随身抄录册，每一页都等着写下细密推演。'
    },
    shop_ice_bookmark: {
      id: 'shop_ice_bookmark',
      name: '雪晶雕花书签',
      category: 'shop',
      rarity: 'rare',
      src: BASE_PATH + 'shop_ice_bookmark.webp',
      desc: '仿六瓣冰花打磨的剔透金属书签，日光斜照时映出浅蓝微芒。自用：魔力适性 +2 · 点亮挂件。',
      lore: '薄如蝉翼的雕花书签，夹在常翻的魔导笔记页间分外合衬。'
    },
    shop_sword_tassel_oil: {
      id: 'shop_sword_tassel_oil',
      name: '乌木护刃清油',
      category: 'shop',
      rarity: 'rare',
      src: BASE_PATH + 'shop_sword_tassel_oil.webp',
      desc: '细密松香调制的保养清油，拭过木剑与铁锋后手感温润不滑。自用：体能 +2、攻击 +1。',
      lore: '沉静清雅的松香护刃油瓶，令经年老剑在北境严寒里也保持温润锋芒。'
    },
    shop_polar_lily_dried: {
      id: 'shop_polar_lily_dried',
      name: '北极铃兰干花',
      category: 'shop',
      rarity: 'rare',
      src: BASE_PATH + 'shop_polar_lily_dried.webp',
      desc: '借寒气封存的淡白铃兰标本，花瓣在玻璃夹片间完好如初。自用：魔力适性 +2、悠闲度 +8。',
      lore: '来自北境雪线之畔的素白干花，轻摇仿佛能听见无声的风铃回响。'
    },
    shop_frost_cedar_sachet: {
      id: 'shop_frost_cedar_sachet',
      name: '霜杉干叶香囊',
      category: 'shop',
      rarity: 'rare',
      src: BASE_PATH + 'shop_frost_cedar_sachet.webp',
      desc: '素白细麻缝制的清雅香囊，满载公爵府冬园般沉静的霜杉气息。自用：气质 +2、悠闲度 +10 · 挂件。',
      lore: '盛着干霜杉针叶的浅蓝细麻布囊，闻起来有公爵府冬园气息。'
    },
    shop_silver_moon_clip: {
      id: 'shop_silver_moon_clip',
      name: '银月蓝晶发夹',
      category: 'shop',
      rarity: 'rare',
      src: BASE_PATH + 'shop_silver_moon_clip.webp',
      desc: '纤细银枝镶着一小粒天青晶石，别在鬓侧清丽脱俗。自用：气质 +3 · 点亮挂件。',
      lore: '素雅纤巧的银蓝月牙发夹，收拢鬓边碎发刚刚好。'
    },
    shop_magic_theory_notes: {
      id: 'shop_magic_theory_notes',
      name: '梅林阻率批注集',
      category: 'shop',
      rarity: 'epic',
      src: BASE_PATH + 'shop_magic_theory_notes.webp',
      desc: '收录多位高阶法师实测勘误的珍贵抄本，省去大量盲目试错工夫。自用：心智 +2、魔力适性 +2。',
      lore: '批注详实、图表严谨的魔导实测集，纸边留有前人反复验算的折痕。'
    },
    shop_warming_frost_stone: {
      id: 'shop_warming_frost_stone',
      name: '温霜护手怀石',
      category: 'shop',
      rarity: 'epic',
      src: BASE_PATH + 'shop_warming_frost_stone.webp',
      desc: '赫兰匠人打磨的奇巧暖石，表层清凉却能持久散出柔和暖意。自用：体力 +2、魔力 +20 · 挂件。',
      lore: '内蕴微温的淡青石块，寒夜揣在袖袋里格外安心。'
    },
    alice_letter: {
      id: 'alice_letter',
      name: '爱丽丝的风铃草信笺',
      category: 'keepsake',
      rarity: 'rare',
      src: BASE_PATH + 'alice_letter.webp',
      desc: '学院北侧风铃草夹页信笺，字字载着妹妹安静而细密的牵挂。',
      lore: '淡蓝信纸的折痕被压得极平，夹页间仍残存着一丝清浅的风息与花香。'
    },
    peilin_note: {
      id: 'peilin_note',
      name: '沛霖的药行纸条',
      category: 'keepsake',
      rarity: 'rare',
      src: BASE_PATH + 'peilin_note.webp',
      desc: '苏秦商路药商沛霖留下的便笺，载有止血青藓护运诀窍与北风堡问讯凭据。',
      lore: '裁得工整的粗纹便笺，纸角带着微苦的干草药与温茶余韵。'
    }
  };

  // 显式无图占位键（如战斗徒手导魔），永不误匹配任何实绘物品
  var NULL_KEYS = {
    none: 1,
    barehand: 1,
    unarmed: 1,
    empty: 1,
    '徒手': 1,
    '徒手导魔': 1,
    '无': 1
  };

  // 英文 / 历史系统键名别名表（一律按小写下划线归一化后命中）
  var ALIASES = {
    // 法杖
    wand_eclipse: 'eclipse_wand',
    eclipse_staff: 'eclipse_wand',
    wand: 'eclipse_wand',
    staff_eclipse: 'eclipse_wand',
    saint_staff: 'north_saint_staff',
    north_staff: 'north_saint_staff',
    polar_saint_staff: 'north_saint_staff',
    staff_north_saint: 'north_saint_staff',

    // 随身铭记
    pebble: 'ice_pebble',
    ice_stone: 'ice_pebble',
    vial: 'blue_vial',
    sky_vial: 'blue_vial',
    flower_cake: 'alice_flower_cake',
    alice_cake: 'alice_flower_cake',
    wind_flower_cake: 'alice_flower_cake',
    manuscript: 'noelle_manuscript',
    mana_manuscript: 'noelle_manuscript',
    shell: 'shell_pin',
    moon_shell_pin: 'shell_pin',
    schedule: 'belmont_schedule',
    patrol_schedule: 'belmont_schedule',
    charlotte_schedule: 'belmont_schedule',
    silver_cross: 'cross',
    helena_cross: 'cross',
    sword: 'ebony_sword',
    iron_sword: 'ebony_sword',
    purple_tassel_sword: 'ebony_sword',
    jikan_sword: 'ebony_sword',
    cipher: 'frost_cipher',
    frost_badge: 'frost_cipher',
    aino_handkerchief: 'aino_academy_handkerchief',
    handkerchief: 'aino_academy_handkerchief',
    snow_handkerchief: 'aino_academy_handkerchief',
    frost_shard: 'aino_frost_shard',
    steel_ice_shard: 'aino_frost_shard',
    north_pass: 'northwind_pass',
    northwind_token: 'northwind_pass',
    pass: 'northwind_pass',

    // 剧情 / 消耗 / 信物
    hot_cookie: 'cookie',
    warm_cookie: 'cookie',
    biscuit: 'cookie',
    errata: 'noelle_errata',
    mail_noelle_errata: 'noelle_errata',
    challenge: 'belmont_challenge',
    charlotte_challenge: 'belmont_challenge',
    letter_alice: 'alice_letter',
    bellflower_letter: 'alice_letter',
    peilin_paper: 'peilin_note',
    herb_note: 'peilin_note',

    // 温馨小铺短键名（去 shop_ 前缀）
    caramel_cookie: 'shop_caramel_cookie',
    mint_tea: 'shop_mint_tea',
    honey_pancake: 'shop_honey_pancake',
    osmanthus_cake: 'shop_osmanthus_cake',
    parchment_journal: 'shop_parchment_journal',
    ice_bookmark: 'shop_ice_bookmark',
    sword_tassel_oil: 'shop_sword_tassel_oil',
    polar_lily_dried: 'shop_polar_lily_dried',
    frost_cedar_sachet: 'shop_frost_cedar_sachet',
    silver_moon_clip: 'shop_silver_moon_clip',
    magic_theory_notes: 'shop_magic_theory_notes',
    warming_frost_stone: 'shop_warming_frost_stone'
  };

  // 中文名精确映射表
  var CN_EXACT_MAP = {
    '晦轮杖': 'eclipse_wand',
    '晦轮法杖': 'eclipse_wand',
    '极北圣晶杖': 'north_saint_staff',
    '圣晶杖': 'north_saint_staff',
    '冰蓝石子': 'ice_pebble',
    '冰蓝小石': 'ice_pebble',
    '淡蓝小瓶': 'blue_vial',
    '晴空小瓶': 'blue_vial',
    '风之花饼': 'alice_flower_cake',
    '爱丽丝的花饼': 'alice_flower_cake',
    '蜂蜜花饼': 'alice_flower_cake',
    '省魔手稿': 'noelle_manuscript',
    '诺艾儿的省魔手稿': 'noelle_manuscript',
    '月虹螺胸针': 'shell_pin',
    '月虹螺': 'shell_pin',
    '无名巡防抄件': 'belmont_schedule',
    '巡防抄件': 'belmont_schedule',
    '银十字架': 'cross',
    '十字架': 'cross',
    '乌木紫穗剑': 'ebony_sword',
    '乌木铁剑': 'ebony_sword',
    '紫蝶剑穗': 'ebony_sword',
    '霜封暗记': 'frost_cipher',
    '雪纹手帕': 'aino_academy_handkerchief',
    '雪花纹手帕': 'aino_academy_handkerchief',
    '钢冰试炼笺': 'aino_frost_shard',
    '钢冰铭牌': 'aino_frost_shard',
    '北风堡木牌': 'northwind_pass',
    '北风堡通关木牌': 'northwind_pass',
    '热饼干': 'cookie',
    '小饼干': 'cookie',
    '精算勘误册': 'noelle_errata',
    '勘误册': 'noelle_errata',
    '烫金战书羊皮笺': 'belmont_challenge',
    '烫金战书': 'belmont_challenge',
    '约战书': 'belmont_challenge',
    '焦糖黄油曲奇': 'shop_caramel_cookie',
    '焦糖曲奇': 'shop_caramel_cookie',
    '冰镇薄荷叶茶': 'shop_mint_tea',
    '薄荷叶茶': 'shop_mint_tea',
    '薄荷茶': 'shop_mint_tea',
    '蜂蜜松饼礼盒': 'shop_honey_pancake',
    '蜂蜜松饼': 'shop_honey_pancake',
    '澄岚桂花米糕': 'shop_osmanthus_cake',
    '桂花米糕': 'shop_osmanthus_cake',
    '羊皮抄录本': 'shop_parchment_journal',
    '手账本': 'shop_parchment_journal',
    '雪晶雕花书签': 'shop_ice_bookmark',
    '雪晶书签': 'shop_ice_bookmark',
    '乌木护刃清油': 'shop_sword_tassel_oil',
    '护刃清油': 'shop_sword_tassel_oil',
    '北极铃兰干花': 'shop_polar_lily_dried',
    '铃兰干花': 'shop_polar_lily_dried',
    '霜杉干叶香囊': 'shop_frost_cedar_sachet',
    '霜杉香囊': 'shop_frost_cedar_sachet',
    '银月蓝晶发夹': 'shop_silver_moon_clip',
    '银月发夹': 'shop_silver_moon_clip',
    '梅林阻率批注集': 'shop_magic_theory_notes',
    '阻率批注集': 'shop_magic_theory_notes',
    '温霜护手怀石': 'shop_warming_frost_stone',
    '温霜怀石': 'shop_warming_frost_stone',
    '爱丽丝的风铃草信笺': 'alice_letter',
    '风铃草信笺': 'alice_letter',
    '爱丽丝的信': 'alice_letter',
    '沛霖的药行纸条': 'peilin_note',
    '药行纸条': 'peilin_note',
    '药行便笺': 'peilin_note'
  };

  // 中文名模糊兜底规则（按特征词长短与特异度排序，防误命中）
  var CN_FUZZY_RULES = [
    { kw: '晦轮', id: 'eclipse_wand' },
    { kw: '圣晶杖', id: 'north_saint_staff' },
    { kw: '极北圣晶', id: 'north_saint_staff' },
    { kw: '冰蓝石', id: 'ice_pebble' },
    { kw: '淡蓝小瓶', id: 'blue_vial' },
    { kw: '晴空小瓶', id: 'blue_vial' },
    { kw: '花饼', id: 'alice_flower_cake' },
    { kw: '省魔手稿', id: 'noelle_manuscript' },
    { kw: '勘误册', id: 'noelle_errata' },
    { kw: '月虹螺', id: 'shell_pin' },
    { kw: '巡防抄件', id: 'belmont_schedule' },
    { kw: '换防时间表', id: 'belmont_schedule' },
    { kw: '烫金战书', id: 'belmont_challenge' },
    { kw: '战书羊皮', id: 'belmont_challenge' },
    { kw: '十字架', id: 'cross' },
    { kw: '护刃清油', id: 'shop_sword_tassel_oil' },
    { kw: '紫穗剑', id: 'ebony_sword' },
    { kw: '乌木铁剑', id: 'ebony_sword' },
    { kw: '紫蝶剑穗', id: 'ebony_sword' },
    { kw: '霜封暗记', id: 'frost_cipher' },
    { kw: '手帕', id: 'aino_academy_handkerchief' },
    { kw: '钢冰试炼', id: 'aino_frost_shard' },
    { kw: '北风堡', id: 'northwind_pass' },
    { kw: '通关木牌', id: 'northwind_pass' },
    { kw: '焦糖黄油曲奇', id: 'shop_caramel_cookie' },
    { kw: '焦糖曲奇', id: 'shop_caramel_cookie' },
    { kw: '曲奇', id: 'shop_caramel_cookie' },
    { kw: '薄荷叶茶', id: 'shop_mint_tea' },
    { kw: '薄荷茶', id: 'shop_mint_tea' },
    { kw: '蜂蜜松饼', id: 'shop_honey_pancake' },
    { kw: '松饼礼盒', id: 'shop_honey_pancake' },
    { kw: '桂花米糕', id: 'shop_osmanthus_cake' },
    { kw: '米糕', id: 'shop_osmanthus_cake' },
    { kw: '羊皮抄录', id: 'shop_parchment_journal' },
    { kw: '抄录本', id: 'shop_parchment_journal' },
    { kw: '雪晶雕花书签', id: 'shop_ice_bookmark' },
    { kw: '雪晶书签', id: 'shop_ice_bookmark' },
    { kw: '书签', id: 'shop_ice_bookmark' },
    { kw: '铃兰干花', id: 'shop_polar_lily_dried' },
    { kw: '北极铃兰', id: 'shop_polar_lily_dried' },
    { kw: '霜杉', id: 'shop_frost_cedar_sachet' },
    { kw: '香囊', id: 'shop_frost_cedar_sachet' },
    { kw: '银月蓝晶', id: 'shop_silver_moon_clip' },
    { kw: '银月发夹', id: 'shop_silver_moon_clip' },
    { kw: '发夹', id: 'shop_silver_moon_clip' },
    { kw: '梅林阻率', id: 'shop_magic_theory_notes' },
    { kw: '阻率批注', id: 'shop_magic_theory_notes' },
    { kw: '温霜', id: 'shop_warming_frost_stone' },
    { kw: '护手怀石', id: 'shop_warming_frost_stone' },
    { kw: '风铃草信笺', id: 'alice_letter' },
    { kw: '爱丽丝', id: 'alice_letter' },
    { kw: '沛霖', id: 'peilin_note' },
    { kw: '药行纸条', id: 'peilin_note' },
    { kw: '药行便笺', id: 'peilin_note' },
    { kw: '热饼干', id: 'cookie' },
    { kw: '饼干', id: 'cookie' }
  ];

  function escapeAttr(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normalizeAsciiKey(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    // 若传入的是 assets/items/xxx.webp 路径，剥离前缀与扩展名
    if (s.indexOf('/') !== -1) {
      s = s.split('/').pop();
    }
    s = s.replace(/\.(webp|png|jpg|jpeg|svg)$/i, '');
    return s
      .toLowerCase()
      .replace(/[\s\-]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  function resolveSingleValue(val) {
    if (val == null) return null;
    var raw = String(val).trim();
    if (!raw) return null;

    var lower = raw.toLowerCase();
    if (NULL_KEYS[raw] || NULL_KEYS[lower]) return null;

    // 1. 直接命中规范 ID
    if (ITEMS[raw]) return raw;

    // 2. 归一化英文/下划线键命中规范 ID 或别名表
    var norm = normalizeAsciiKey(raw);
    if (!norm || NULL_KEYS[norm]) return null;
    if (ITEMS[norm]) return norm;
    if (ALIASES[norm]) return ALIASES[norm];

    // 3. 中文名精确命中（去掉书名号/方括号/空格后比对）
    var cnClean = raw.replace(/[\s【】「」『』《》·•・]/g, '');
    if (NULL_KEYS[cnClean]) return null;
    if (CN_EXACT_MAP[raw]) return CN_EXACT_MAP[raw];
    if (CN_EXACT_MAP[cnClean]) return CN_EXACT_MAP[cnClean];

    // 4. 中文名模糊兜底（需包含中文字符，避免英文短词误碰）
    if (/[\u4e00-\u9fff]/.test(cnClean)) {
      for (var i = 0; i < CN_FUZZY_RULES.length; i++) {
        if (cnClean.indexOf(CN_FUZZY_RULES[i].kw) !== -1) {
          return CN_FUZZY_RULES[i].id;
        }
      }
    }

    return null;
  }

  /**
   * 归一化道具键、别名、路径、中文名或道具对象为标准 31 项 ID；无对应实图返回 null
   */
  function resolveItemId(keyOrName) {
    if (keyOrName == null) return null;
    if (typeof keyOrName === 'object') {
      var byId = resolveSingleValue(keyOrName.id || keyOrName.itemId || keyOrName.key);
      if (byId) return byId;
      return resolveSingleValue(keyOrName.name || keyOrName.title);
    }
    return resolveSingleValue(keyOrName);
  }

  /**
   * 获取道具完整元数据（含 id, name, category, rarity, src, desc, lore）
   */
  function getItem(keyOrName) {
    var id = resolveItemId(keyOrName);
    return id ? ITEMS[id] : null;
  }

  /**
   * 返回标准相对图标 URL `'assets/items/{id}.webp'`，无对应图时返回 null
   */
  function getIconUrl(keyOrName) {
    var id = resolveItemId(keyOrName);
    return id ? ITEMS[id].src : null;
  }

  /**
   * 生成雪瓷冰晶体系棱镜占位 SVG（用于徒手 `none` 或未录入临时物品，避免破图）
   */
  function buildPrismFallbackSVG(opts, label) {
    var o = opts || {};
    var size = Number(o.size);
    var hasSize = isFinite(size) && size > 0;
    var extraCls = o.className || o.cls || '';
    var cls = ('item-art-svg item-art-fallback' + (extraCls ? ' ' + extraCls : '')).trim();
    var styleAttr = o.style ? ' style="' + escapeAttr(o.style) + '"' : '';
    var dimAttrs = hasSize ? ' width="' + Math.round(size) + '" height="' + Math.round(size) + '"' : '';
    var ariaAttr = o.decorative || o.ariaHidden
      ? ' aria-hidden="true"'
      : ' role="img" aria-label="' + escapeAttr(label || '魔导棱镜') + '"';
    var titleAttr = o.title ? ' data-title="' + escapeAttr(o.title) + '"' : '';

    return (
      '<svg class="' + escapeAttr(cls) + '"' + dimAttrs + styleAttr + titleAttr + ariaAttr +
      ' viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<polygon points="18,4 29,18 18,32 7,18" fill="rgba(22,88,235,0.08)" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<polygon points="18,9.5 24,18 18,26.5 12,18" fill="rgba(56,189,248,0.16)" stroke="currentColor" stroke-width="1.15" stroke-linejoin="round"/>' +
      '<line x1="7" y1="18" x2="29" y2="18" stroke="currentColor" stroke-width="1" opacity="0.55"/>' +
      '<circle cx="18" cy="18" r="1.8" fill="currentColor"/>' +
      '</svg>'
    );
  }

  /**
   * 渲染标准化道具实图 <img>；无对应图时自动降级为简洁冰晶棱镜 SVG
   */
  function renderIconHTML(keyOrName, opts) {
    var o = opts || {};
    var id = resolveItemId(keyOrName);
    var meta = id ? ITEMS[id] : null;
    var extraCls = o.className || o.cls || '';

    if (!meta) {
      var fallbackLabel = o.alt || o.fallbackLabel ||
        (typeof keyOrName === 'object' && keyOrName ? keyOrName.name : '') ||
        (String(keyOrName || '').trim() === 'none' ? '徒手导魔' : '魔导棱镜');
      return buildPrismFallbackSVG(o, fallbackLabel);
    }

    var cls = ('item-art-img item-art-img--' + id + (extraCls ? ' ' + extraCls : '')).trim();
    var altText = o.alt != null ? String(o.alt) : meta.name;
    var loading = o.eager ? 'eager' : (o.loading || 'lazy');
    var decoding = o.decoding || 'async';
    var size = Number(o.size);
    var dimAttrs = (isFinite(size) && size > 0)
      ? ' width="' + Math.round(size) + '" height="' + Math.round(size) + '"'
      : '';
    var styleAttr = o.style ? ' style="' + escapeAttr(o.style) + '"' : '';
    var titleAttr = o.title ? ' title="' + escapeAttr(o.title) + '"' : '';
    var ariaAttr = (o.decorative || o.ariaHidden) ? ' aria-hidden="true"' : '';

    return (
      '<img class="' + escapeAttr(cls) + '"' +
      ' src="' + escapeAttr(meta.src) + '"' +
      ' alt="' + escapeAttr(o.decorative || o.ariaHidden ? '' : altText) + '"' +
      dimAttrs +
      styleAttr +
      titleAttr +
      ariaAttr +
      ' data-item-id="' + escapeAttr(id) + '"' +
      ' loading="' + escapeAttr(loading) + '"' +
      ' decoding="' + escapeAttr(decoding) + '"' +
      ' draggable="false">'
    );
  }

  /**
   * 返回全部 31 个相对 URL 数组（供 AssetPreloader 空闲后台预热）
   */
  function listAllUrls() {
    var urls = [];
    for (var i = 0; i < ORDER.length; i++) {
      urls.push(ITEMS[ORDER[i]].src);
    }
    return urls;
  }

  var api = {
    VERSION: '1.0.0',
    BASE_PATH: BASE_PATH,
    ORDER: ORDER.slice(),
    ITEMS: ITEMS,
    ALIASES: ALIASES,
    resolveItemId: resolveItemId,
    getItem: getItem,
    hasArt: function (keyOrName) { return !!resolveItemId(keyOrName); },
    getIconUrl: getIconUrl,
    renderIconHTML: renderIconHTML,
    listAllUrls: listAllUrls
  };

  if (typeof window !== 'undefined') {
    window.ItemArtRegistry = api;
  } else if (root) {
    root.ItemArtRegistry = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
