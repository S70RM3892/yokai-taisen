// ============================================================================
// 全員に「固有の特性」をつける。
//
// 本家の妖怪は 1 体ずつ「スキル」を持つ。ここでは 1 体ずつ別の特性を持たせる：
//   特性 = 主効果（その妖怪の戦い方。ロールと段階で強さが変わる）
//        + 一族の効果（伝承にちなんだ小さな効果。一族ごとに違う）
// 名前は「一族の言葉」＋「主効果の段階名」なので、全員ちがう名前・ちがう中身になる。
// 数値はすべて‰（1000 分率）か固定値。対戦ロジックは unit.fx を読む。
//
// 魂（本家の「魂へんげ」）: その妖怪の特性の数値を半分にして、ほかの妖怪が装備できる。
// ============================================================================

// 主効果：段階（小 / 並 / 大）ごとの値
var ARCH = {
  rage: { w: ["逆上", "激昂", "逆鱗"], fx: [{ rage: 400 }, { rage: 500 }, { rage: 600, rageAt: 300 }] },
  guardBreak: { w: ["甲割り", "破甲", "金剛砕き"], fx: [{ guardBreak: 1 }, { guardBreak: 1, atkUp: 60 }, { guardBreak: 1, atkUp: 120 }] },
  keystone: { w: ["礎", "要石", "大黒柱"], fx: [{ keystone: 250 }, { keystone: 300 }, { keystone: 350 }] },
  fireAdept: { w: ["火の心得", "火の極意", "劫火"], fx: [{ adept_fire: 1200 }, { adept_fire: 1250 }, { adept_fire: 1300 }] },
  waterAdept: { w: ["水の心得", "水の極意", "大海"], fx: [{ adept_water: 1200 }, { adept_water: 1250 }, { adept_water: 1300 }] },
  thunderAdept: { w: ["雷の心得", "雷の極意", "雷神"], fx: [{ adept_thunder: 1200 }, { adept_thunder: 1250 }, { adept_thunder: 1300 }] },
  earthAdept: { w: ["土の心得", "土の極意", "大地"], fx: [{ adept_earth: 1200 }, { adept_earth: 1250 }, { adept_earth: 1300 }] },
  iceAdept: { w: ["氷の心得", "氷の極意", "氷獄"], fx: [{ adept_ice: 1200 }, { adept_ice: 1250 }, { adept_ice: 1300 }] },
  windAdept: { w: ["風の心得", "風の極意", "神風"], fx: [{ adept_wind: 1200 }, { adept_wind: 1250 }, { adept_wind: 1300 }] },
  endure: { w: ["ふんばり", "踏ん張り", "不動"], fx: [{ endure: 1 }, { endure: 1, up_def: 50 }, { endure: 1, up_def: 100 }] },
  doubleEndure: { w: ["二度の踏ん張り", "七転八起", "不死身"], fx: [{ endure: 2 }, { endure: 2 }, { endure: 2, up_def: 60 }] },
  tailwind: { w: ["そよ風", "追い風", "疾風迅雷"], fx: [{ tailwind: 80 }, { tailwind: 100 }, { tailwind: 130 }] },
  devour: { w: ["つまみ食い", "屍喰い", "大喰らい"], fx: [{ devour: 150 }, { devour: 200 }, { devour: 250 }] },
  grudge: { w: ["恨み", "怨念", "祟り"], fx: [{ grudge: 200 }, { grudge: 250 }, { grudge: 300 }] },
  curseMaster: { w: ["呪いの手ほどき", "呪詛の才", "呪術の極み"], fx: [{ curseMaster: 1 }, { curseMaster: 1, curseHit: 50 }, { curseMaster: 1, curseHit: 100 }] },
  unbreakable: { w: ["気丈", "不屈", "金剛心"], fx: [{ unbreakable: 1 }, { unbreakable: 1, up_def: 40 }, { unbreakable: 1, up_def: 80 }] },
  thorns: { w: ["トゲ", "毒の肌", "針地獄"], fx: [{ thorns: 200 }, { thorns: 250 }, { thorns: 300 }] },
  mirror: { w: ["照り返し", "鏡返し", "八咫鏡"], fx: [{ mirror: 400 }, { mirror: 500 }, { mirror: 600 }] },
  ironGuard: { w: ["構え", "鉄壁", "金城鉄壁"], fx: [{ ironGuard: 300 }, { ironGuard: 250 }, { ironGuard: 200 }] },
  drain: { w: ["吸い取り", "吸精", "精気喰らい"], fx: [{ drain: 200 }, { drain: 250 }, { drain: 300 }] },
  waterEater: { w: ["水喰い", "水喰い", "水喰い"], fx: [{ waterEater: 1 }, { waterEater: 1 }, { waterEater: 1 }] },
  hidden: { w: ["物陰", "隠れ身", "神隠し"], fx: [{ hidden: 1 }, { hidden: 1, evade: 30 }, { hidden: 1, evade: 60 }] },
  firstStrike: { w: ["一番乗り", "先駆け", "電光石火"], fx: [{ firstStrike: 1 }, { firstStrike: 1, up_spd: 40 }, { firstStrike: 1, up_spd: 80 }] },
  spiritSmoke: { w: ["福の香", "福の気", "福徳円満"], fx: [{ spiritSmoke: 400 }, { spiritSmoke: 500 }, { spiritSmoke: 600 }] },
  prayer: { w: ["願い", "祈り", "加護"], fx: [{ prayer: 15 }, { prayer: 20 }, { prayer: 25 }] },
  benchHeal: { w: ["見守り", "後見", "守護霊"], fx: [{ benchHeal: 8 }, { benchHeal: 10 }, { benchHeal: 12 }] },
  conqueror: { w: ["勝ち名乗り", "勝ち鬨", "天下取り"], fx: [{ conqueror: 120 }, { conqueror: 150 }, { conqueror: 180 }] },
  critEye: { w: ["目利き", "一閃", "必中"], fx: [{ critEye: 18 }, { critEye: 22 }, { critEye: 26 }] },
  ultEvade: { w: ["身かわし", "見切り", "明鏡止水"], fx: [{ ultEvade: 700 }, { ultEvade: 850 }, { ultEvade: 1000 }] },
  scapegoat: { w: ["盾頼み", "身代わり頼み", "影武者"], fx: [{ scapegoat: 1 }, { scapegoat: 1, up_spd: 50 }, { scapegoat: 1, up_spd: 100 }] },
  guardian: { w: ["かばう", "かばい手", "守護神"], fx: [{ guardian: 1 }, { guardian: 1, up_def: 50 }, { guardian: 1, up_def: 100 }] },
};

// 一族の効果：[一族の言葉, 効果キー, 基準値]（段階 小 ×0.7 / 並 ×1.0 / 大 ×1.3）
var FAMILY_FX = {
  // 猛（鬼の一族）
  茨木童子: ["羅生門", "hitSg", 80], 星熊童子: ["星砕き", "atkUp", 120], 金熊童子: ["金剛", "up_def", 80],
  虎熊童子: ["虎爪", "critDmg", 250], 熊童子: ["熊掌", "guardHeal", 60], 牛頭: ["獄卒", "vsCursed", 200],
  馬頭: ["奔馬", "up_spd", 80], 羅刹: ["喰鬼", "killSg", 200], 夜叉: ["夜叉守", "lowDef", 200],
  悪路王: ["蝦夷王", "noLoaf", 500], 温羅: ["吉備の鬼", "regen", 30], 宿儺: ["両面", "evade", 80],
  手長: ["長腕", "sgSteal", 100], 足長: ["長脚", "spdLow", 250], 大百足: ["百足", "inflict_poison", 120],
  山男: ["山の剛力", "up_atk", 80], 山爺: ["一つ目爺", "foodUp", 300], 鬼熊: ["鬼熊", "hitSg", 100],
  // 怪（あやしの火・狐）
  狐火: ["狐の灯", "skillUp", 120], 釣瓶火: ["釣瓶落とし", "sgRate", 200], 不知火: ["海の怪火", "resist_water", 250],
  竜灯: ["龍の灯明", "ultUp", 150], 天火: ["天降る火", "inflict_confuse", 100], 叢原火: ["坊主火", "vsCursed", 220],
  古籠火: ["籠の火", "startSg", 300], 青行灯: ["百物語", "benchSg", 30], 陰摩羅鬼: ["屍の気", "killSg", 220],
  雷獣: ["雷落とし", "inflict_stun", 80], 鵺: ["鵺の声", "counter_confuse", 200], 管狐: ["竹筒の狐", "sgSteal", 120],
  白蔵主: ["狐の僧", "curseResist", 250], 妖狐: ["九尾", "evade", 90], 葛の葉: ["信太の森", "deathHeal", 150],
  // 祟（たたりの一族）
  土蜘蛛: ["蜘蛛の糸", "inflict_slow", 150], 絡新婦: ["女郎蜘蛛", "counter_slow", 200], 姑獲鳥: ["産女", "deathSg", 250],
  怨霊: ["怨嗟", "counter_weaken", 200], 生霊: ["生き霊", "regen", 35], 死霊: ["死者の手", "inflict_weaken", 120],
  骨女: ["骨の舞", "evade", 70], 餓鬼: ["飢え", "foodUp", 500], 目目連: ["障子の目", "vsCursed", 180],
  蛇帯: ["蛇の帯", "inflict_poison", 130], 縊鬼: ["首くくり", "inflict_seal", 100], 逆柱: ["家鳴らし", "counter_stun", 150],
  橋姫: ["嫉妬", "vsTribe_miyabi", 250], 清姫: ["蛇身の執念", "spdLow", 280], 七人ミサキ: ["七人", "killSg", 250],
  // 雅（猫・付喪神・あやかしの女）
  化け猫: ["猫の爪", "sgSteal", 110], 五徳猫: ["五徳の火", "resist_fire", 280], 化け草履: ["草履の足音", "up_spd", 70],
  琴古主: ["琴の音", "counter_confuse", 180], 琵琶牧々: ["琵琶法師", "inflict_confuse", 90], 三味長老: ["三味線", "sgRate", 180],
  瀬戸大将: ["瀬戸物", "lowDef", 180], 鳴釜: ["吉凶の釜", "ultUp", 130], 払子守: ["払子", "purifyFast", 400],
  木魚達磨: ["木魚", "noLoaf", 400], 面霊気: ["能面", "counter_weaken", 180], 文車妖妃: ["恋文", "vsTribe_kage", 220],
  白粉婆: ["白粉", "curseShort", 250], お歯黒べったり: ["鉄漿", "inflict_brittle", 120], 高女: ["覗き見", "critDmg", 220],
  二口女: ["後ろの口", "foodUp", 400], 飛頭蛮: ["飛ぶ首", "evade", 75], 化け提灯: ["提灯の舌", "startSg", 320],
  // 剛（かたい一族）
  塗仏: ["黒い仏", "regen", 25], 大入道: ["大入道", "up_def", 90], 見上げ入道: ["見越し", "curseResist", 280],
  牛打ち坊: ["牛打ち", "guardHeal", 70], 石妖: ["石の化生", "resist_earth", 250], 夜泣き石: ["夜泣き", "hitSg", 90],
  殺生石: ["毒気", "counter_poison", 200], 岩魚坊主: ["岩魚", "resist_water", 280], 大座頭: ["座頭", "noLoaf", 600],
  山地乳: ["寝息吸い", "sgSteal", 90], 野槌: ["野槌", "lowDef", 220], 蟹坊主: ["蟹の甲", "resist_ice", 250],
  栄螺鬼: ["栄螺の殻", "resist_thunder", 250], 鉄鼠: ["経喰い", "inflict_seal", 110], 大亀: ["万年", "regen", 40],
  鎧武者: ["大鎧", "vsTribe_takeru", 200], 埴輪武者: ["埴輪", "startSg", 300], 石塔: ["石塔", "curseShort", 300],
  // 鎮（しずめの一族）
  獏: ["夢喰い", "purifyFast", 500], 八咫烏: ["導き", "up_spd", 90], 守宮: ["家守", "guardHeal", 60],
  石敢當: ["魔除け", "curseResist", 300], 道祖神: ["塞の神", "lowDef", 250], 霊亀: ["霊亀の甲", "regen", 30],
  白蛇: ["弁天の使い", "healUp", 200], 大鯰: ["地震", "inflict_stun", 100], 蛟: ["水龍", "skillUp", 130],
  人魚: ["人魚の肉", "deathHeal", 180], 共潜き: ["海女の影", "evade", 80], 磯女: ["磯の髪", "sgSteal", 100],
  濡れ女: ["濡れ髪", "inflict_slow", 120], 海和尚: ["海坊主", "resist_water", 300], 神鹿: ["神の鹿", "blessLong", 300],
  狛狐: ["稲荷の守り", "benchRegen", 10],
  // 影（すばやい一族）
  烏天狗: ["兵法", "critDmg", 250], 木の葉天狗: ["木の葉隠れ", "evade", 85], 以津真天: ["いつまで", "deathSg", 250],
  飛縁魔: ["魔性", "inflict_confuse", 110], 風狸: ["風に乗る", "up_spd", 80], すねこすり: ["足元", "inflict_slow", 130],
  送り犬: ["送り", "benchSg", 30], 送り狼: ["狼の牙", "killSg", 210], 狢: ["化かし", "counter_confuse", 150],
  飯綱: ["飯綱使い", "sgRate", 200], 片輪車: ["炎の車輪", "atkUp", 110], 朧車: ["牛車", "spdLow", 250],
  輪入道: ["業火の輪", "resist_fire", 250], 鎌風: ["旋風", "noLoaf", 500], 疾風丸: ["疾風", "startSg", 300],
  韋駄天狐: ["韋駄天", "up_spd", 100], 野鉄砲: ["吹き矢", "inflict_seal", 100], 野衾: ["むささび", "sgSteal", 110],
  隼人: ["隼", "critDmg", 280], 夜雀: ["夜の群れ", "hitSg", 80], 通り悪魔: ["魔が差す", "inflict_confuse", 120],
  隙間風: ["すきま", "evade", 90], 一本だたら: ["一本足", "spdLow", 300],
  // 和（なごみの一族）
  福の神: ["福", "foodUp", 300], 竈神: ["かまど", "healUp", 200], 蔵ぼっこ: ["蔵守り", "benchSg", 35],
  雨降り小僧: ["雨乞い", "resist_fire", 250], 豆腐小僧: ["豆腐", "deathHeal", 150], 狸囃子: ["腹鼓", "sgRate", 220],
  豆狸: ["化け金", "blessLong", 300], 小豆洗い: ["ざくざく", "benchRegen", 10], 枕返し: ["寝返り", "curseShort", 300],
  家鳴り: ["家鳴", "hitSg", 70], 天女: ["天の衣", "healUp", 220], 羽衣: ["羽衣", "up_spa", 80],
  花の精: ["花", "regen", 30], 桃の精: ["桃", "curseResist", 250], 吉兆鳥: ["吉兆", "startSg", 350],
  霊芝: ["万年茸", "benchRegen", 12],
  // 禍（まがの一族）
  大禍津: ["禍津日", "vsTribe_nagomi", 250], 禍神: ["禍", "inflict_weaken", 130], 黄泉醜女: ["黄泉の追手", "spdLow", 250],
  常闇: ["常闇", "vsCursed", 200], 大魔縁: ["魔縁", "ultUp", 150], 天魔: ["天魔", "atkUp", 120],
  夜刀神: ["蛇神", "counter_poison", 200],
};

// 最初からいる 24 体は、名前も効果も手で決める
var HAND_TRAITS = {
  oni: ["鬼の逆鱗", { rage: 500, atkUp: 120 }],
  karakasa: ["傘の一本足", { ironGuard: 250, resist_water: 250 }],
  yukionna: ["吹雪の化身", { adept_ice: 1250, resist_ice: 300 }],
  nekomata: ["二股の尾", { drain: 250, evade: 80 }],
  kappa: ["皿の水", { waterEater: 1, foodUp: 300 }],
  ogama: ["蝦蟇の油", { thorns: 250, regen: 30 }],
  bakedanuki: ["狸の化け術", { hidden: 1, counter_confuse: 150 }],
  rokurokubi: ["伸びる首", { firstStrike: 1, sgSteal: 100 }],
  zashiki: ["家の福", { spiritSmoke: 500, blessLong: 300 }],
  kodama: ["山の木霊", { prayer: 20, healUp: 200 }],
  tengu: ["天狗の眼", { critEye: 22, critDmg: 300 }],
  kamaitachi: ["三連の鎌", { conqueror: 150, up_spd: 80 }],
  shuten: ["大江山の酒", { guardBreak: 1, regen: 30 }],
  ushioni: ["牛鬼の要", { keystone: 300, counter_poison: 200 }],
  otakemaru: ["鈴鹿の雷", { adept_thunder: 1250, ultUp: 150 }],
  nurikabe: ["通せんぼ", { endure: 1, lowDef: 250 }],
  ittan: ["空飛ぶ布", { tailwind: 100, evade: 80 }],
  onibi: ["鬼火の揺らぎ", { adept_fire: 1250, sgRate: 200 }],
  kasha: ["亡骸さらい", { devour: 200, killSg: 250 }],
  kyokotsu: ["井戸の恨み", { grudge: 250, deathSg: 250 }],
  waira: ["土掘りの呪い", { curseMaster: 1, vsCursed: 200 }],
  komainu: ["阿形の守り", { unbreakable: 1, guardHeal: 60 }],
  yamabiko: ["こだま返し", { mirror: 500, hitSg: 80 }],
  hakutaku: ["万物の知恵", { benchHeal: 10, curseShort: 300 }],
};

var TRIBE_JA = { takeru: "猛", ayashi: "怪", tsuwamono: "剛", kage: "影", nagomi: "和", miyabi: "雅", tatari: "祟", shizume: "鎮", maga: "禍" };
var ELEM_JA = { fire: "火", water: "水", thunder: "雷", earth: "土", ice: "氷", wind: "風" };
var CURSE_JA = { slow: "鈍重", weaken: "衰弱", brittle: "脆化", poison: "蝕毒", seal: "封気", stun: "行動停止", confuse: "混乱" };

// 効果キー → 説明文
function fxLine(k, v) {
  const pct = x => `${Math.round(x / 10)}%`;
  const [head, arg] = k.includes("_") ? k.split(/_(.+)/) : [k, null];
  switch (head) {
    case "rage": return null; // rageAt とまとめて書く
    case "rageAt": return null;
    case "guardBreak": return "こうげきが相手のガードを無視する";
    case "keystone": return `前衛のまん中にいると まもり+${pct(v)}`;
    case "adept": return `${ELEM_JA[arg]}の技の威力 ×${(v / 1000).toFixed(2)}`;
    case "endure": return v >= 2 ? "たおれるダメージを 2 回まで HP1 でこらえる" : "たおれるダメージを 1 回だけ HP1 でこらえる";
    case "tailwind": return `後衛にいると 前衛の味方のすばやさ+${pct(v)}`;
    case "devour": return `相手をたおすと HP を ${pct(v)} 回復`;
    case "grudge": return `たおされると 相手に その相手の最大HPの ${pct(v)} のダメージ`;
    case "curseMaster": return "味方全員の悪いとりつきが 1 段階強くなる";
    case "curseHit": return `悪いとりつきが当たりやすい（+${pct(v)}）`;
    case "unbreakable": return "悪いとりつきを受けない";
    case "thorns": return `こうげきを受けると 相手に ${pct(v)} を返す`;
    case "mirror": return `ようじゅつを受けると 相手に ${pct(v)} を返す`;
    case "ironGuard": return `ガード中のダメージが ${pct(v)} になる（通常 50%）`;
    case "drain": return `こうげき・ようじゅつで与えたダメージの ${pct(v)} を吸いとる`;
    case "waterEater": return "水の技を受けると HP が回復する";
    case "hidden": return "相手からねらわれにくい（ねらう指定がないと選ばれない）";
    case "firstStrike": return "前衛に出たとき 最初の 1 回はすぐ行動する";
    case "spiritSmoke": return `となりの味方の妖気のたまり方+${pct(v)}`;
    case "prayer": return `となりの味方が行動すると その味方の HP を ${pct(v)} 回復`;
    case "benchHeal": return `後衛にいると 行動した前衛の味方の HP を ${pct(v)} 回復`;
    case "conqueror": return `相手をたおすたび ちから+${pct(v)}（3 回まで）`;
    case "critEye": return `クリティカル率アップ（${Math.round(v * 100 / 64)}%）`;
    case "ultEvade": return v >= 1000 ? "相手のひっさつわざを必ずかわす" : `相手のひっさつわざを ${pct(v)} でかわす`;
    case "scapegoat": return "ねらわれると となりの前衛の味方に代わってもらう";
    case "guardian": return "たおれそうな前衛の味方をかばう";
    case "up": return `${STAT_JA[arg]}+${pct(v)}`;
    case "atkUp": return `こうげきの威力+${pct(v)}`;
    case "skillUp": return `ようじゅつの威力+${pct(v)}`;
    case "ultUp": return `ひっさつわざの威力+${pct(v)}`;
    case "healUp": return `回復するひっさつわざ・特性の回復量+${pct(v)}`;
    case "hitSg": return `ダメージを受けると 妖気+${v}`;
    case "killSg": return `相手をたおすと 妖気+${v}`;
    case "regen": return `行動するたび HP を ${pct(v)} 回復`;
    case "startSg": return `妖気 ${v} から始める`;
    case "sgRate": return `妖気のたまり方+${pct(v)}`;
    case "sgSteal": return `こうげきが当たると 相手の妖気を ${v} うばう`;
    case "critDmg": return `クリティカルのダメージ+${pct(v)}`;
    case "vsCursed": return `とりつかれ・サボり中の相手へのダメージ+${pct(v)}`;
    case "vsTribe": return `${TRIBE_JA[arg]}族へのダメージ+${pct(v)}`;
    case "inflict": return `こうげきが当たると ${pct(v)} で相手を${CURSE_JA[arg]}にする`;
    case "counter": return `こうげきを受けると ${pct(v)} で相手を${CURSE_JA[arg]}にする`;
    case "resist": return `${ELEM_JA[arg]}の技のダメージ-${pct(v)}`;
    case "guardHeal": return `ガードすると HP を ${pct(v)} 回復`;
    case "foodUp": return `たべものの回復量+${pct(v)}`;
    case "noLoaf": return v >= 1000 ? "サボらない" : `サボりにくい（-${pct(v)}）`;
    case "lowDef": return `HP が半分以下のとき まもり+${pct(v)}`;
    case "spdLow": return `HP が半分以下のとき すばやさ+${pct(v)}`;
    case "deathSg": return `たおれると 前衛の味方の妖気+${v}`;
    case "deathHeal": return `たおれると 前衛の味方の HP を ${pct(v)} 回復`;
    case "blessLong": return `よいとりつきの時間+${pct(v)}`;
    case "curseResist": return `悪いとりつきを ${pct(v)} でふせぐ`;
    case "curseShort": return `悪いとりつきの時間-${pct(v)}`;
    case "purifyFast": return `おはらいされる速さ+${pct(v)}`;
    case "evade": return `こうげき・ようじゅつを ${pct(v)} でかわす`;
    case "benchSg": return `後衛にいると 味方が行動するたび 妖気+${v}`;
    case "benchRegen": return `後衛にいると 味方が行動するたび HP を ${pct(v)} 回復`;
  }
  return `${k} ${v}`;
}

function fxDesc(fx) {
  const out = [];
  if (fx.rage) out.push(`HP が ${Math.round((fx.rageAt ?? 250) / 10)}% 以下のとき ちから+${Math.round(fx.rage / 10)}%`);
  for (const [k, v] of Object.entries(fx)) {
    const s = fxLine(k, v);
    if (s) out.push(s);
  }
  return out.join("。");
}

// 魂にしたとき半分になる数値（true/false の効果は魂には乗らない）
var SOUL_SKIP = new Set(["guardBreak", "unbreakable", "waterEater", "hidden", "firstStrike", "scapegoat", "guardian", "curseMaster", "endure", "rageAt"]);
function soulFx(fx) {
  const out = {};
  for (const [k, v] of Object.entries(fx)) {
    if (SOUL_SKIP.has(k)) continue;
    if (k.startsWith("adept_")) out[k] = 1000 + Math.floor((v - 1000) / 2);
    else if (k === "ironGuard") out[k] = 500 - Math.floor((500 - v) / 2);
    else if (k === "critEye") out[k] = Math.max(1, 1 + Math.floor((v - 1) / 2));
    else out[k] = Math.max(1, Math.floor(v / 2));
  }
  if (fx.rage) out.rageAt = fx.rageAt ?? 250;
  return out;
}

function unitForm(def) {
  const z = typeof zi !== "undefined" ? zi[def.id] : null;
  if (z) return z.form;
  return def.rank === "S" || def.rank === "A" ? 2 : 1;
}

var TRAIT_TABLE = new Map();
function buildTraits() {
  const names = new Set(), sigs = new Map(), dup = [];
  for (const d of ct) {
    let name, fx;
    if (HAND_TRAITS[d.id]) {
      [name, fx] = HAND_TRAITS[d.id];
      fx = { ...fx };
    } else {
      const fam = zi[d.id].family, form = zi[d.id].form;
      const f = FAMILY_FX[fam];
      if (!f) throw new Error(`no family trait: ${fam}`);
      const a = ARCH[d.trait];
      if (!a) throw new Error(`no archetype: ${d.trait}`);
      name = `${f[0]}の${a.w[form]}`;
      fx = { ...a.fx[form] };
      const mult = [700, 1000, 1300][form];
      const v = Math.round(f[2] * mult / 1000 / 5) * 5 || 1;
      fx[f[1]] = (fx[f[1]] ?? 0) + v;
    }
    if (names.has(name)) throw new Error(`duplicate trait name ${name}`);
    names.add(name);
    const sig = JSON.stringify(Object.entries(fx).sort());
    if (sigs.has(sig)) dup.push(`${d.name} / ${sigs.get(sig)}`);
    sigs.set(sig, d.name);
    const sfx = soulFx(fx);
    TRAIT_TABLE.set(d.id, { name, fx, desc: fxDesc(fx), soulName: `${d.name}の魂`, soulFx: sfx, soulDesc: fxDesc(sfx) });
  }
  if (dup.length) throw new Error(`same trait effect: ${dup.join(", ")}`);
}

function traitOf(def) {
  return TRAIT_TABLE.get(def.id);
}

// ---- 元祖軍 / 本家軍、好物（本家の妖怪ごとの設定にあたるもの） ----
var FAV_BY_FAMILY = {
  kappa: "yasai", nekomata: "gyokai", kasha: "gyokai", 化け猫: "gyokai", 五徳猫: "gyokai", 餓鬼: "niku", oni: "niku", shuten: "oden",
  bakedanuki: "sweets", 豆狸: "sweets", 狸囃子: "dagashi", 豆腐小僧: "oden", 小豆洗い: "sweets", 山爺: "onigiri", 福の神: "onigiri",
  竈神: "curry", zashiki: "dagashi", 人魚: "sushi", 磯女: "sushi", 海和尚: "gyokai", 共潜き: "gyokai", 蟹坊主: "gyokai",
  雨降り小僧: "juice", 天女: "milk", 羽衣: "milk", 狐火: "soba", 妖狐: "soba", 葛の葉: "soba", 白蔵主: "soba", 管狐: "soba",
};
function hash32(s) {
  let t = 2166136261;
  for (let i = 0; i < s.length; i++) t = Math.imul(t ^ s.charCodeAt(i), 16777619);
  return t >>> 0;
}
function favoriteOf(def) {
  const fam = zi[def.id]?.family ?? def.id;
  if (FAV_BY_FAMILY[fam]) return FAV_BY_FAMILY[fam];
  const keys = Object.keys(FOOD_CATS);
  return keys[hash32(fam) % keys.length];
}
function campOf(def) {
  return hash32("camp:" + def.id) % 2 === 0 ? "ganso" : "honke";
}
var CAMP_JA = { ganso: "元祖軍", honke: "本家軍" };
