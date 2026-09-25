// ============================================================================
// 本家（妖怪ウォッチ2 元祖/本家/真打）にあるアイテムをすべて入れる。
//
// 出典（2026-09 確認）:
//   装備: Yo-kai Watch Wiki「List of Equipment/Yo-kai Watch 2」、ゲームエイト「装備一覧」、
//         妖怪ウォッチ2攻略（enjoi.sakura.ne.jp）「アイテム（装備）」。数値が食い違うものは
//         Wiki の値を使い、ゲームエイトのコメント欄でも誤りと指摘されている値は採らない。
//   たべもの: HRS「妖怪ウォッチ2 たべものリスト」（回復量）、妖怪ウォッチ2攻略「アイテム（たべもの）」。
//   どうぐ: ゲームエイト「道具一覧」、Yo-kai Watch Wiki「Items（Battle items）」。
//   好物は同じ種類のたべものの効果が 1.25 倍（HRS / ゲームエイト）。
//
// 本家の「ちから / ようりょく / まもり / すばやさ」は、このゲームの ATK / SPA / DEF / SPD に対応する。
// ============================================================================

// 本家の「食べ物の種類」。好物の判定に使う。
var FOOD_CATS = {
  onigiri: "おにぎり", pan: "パン", dagashi: "駄菓子", chocobar: "チョコボー", milk: "牛乳", juice: "ジュース",
  burger: "ハンバーガー", ramen: "ラーメン", sushi: "すし", chuka: "中華", yasai: "やさい", niku: "にく",
  gyokai: "ぎょかい", curry: "カレー", sweets: "スイーツ", oden: "おでん", snack: "スナック", soba: "そば"
};

// ---- 装備（本家 74 種 + このゲーム独自 9 種） ----
// mods: 足し引きする能力値。special: 数値以外の効果。only: 装備できる妖怪の条件（本家の専用装備）。
var EQUIP_ONLY = {
  cat: { label: "ネコの妖怪専用", test: d => /猫|nekomata|kasha/.test(__famOf(d)) || d.id === "kasha" },
  jiba: { label: "化け猫の一族専用（本家：ジバニャン専用）", test: d => __famOf(d) === "化け猫" || d.id === "nekomata" },
  tengu: { label: "天狗の妖怪専用", test: d => /天狗|天魔|大魔縁/.test(__famOf(d)) || d.id === "tengu" },
  kappa: { label: "カッパの妖怪専用", test: d => d.id === "kappa" || /河童|共潜き/.test(__famOf(d)) },
  ninja: { label: "忍びの妖怪専用（本家：セミまる・カゲまる専用）", test: d => /疾風丸|隼人|鎌風/.test(__famOf(d)) || d.id === "kamaitachi" },
  oni: { label: "鬼の妖怪専用（本家：ゴクドー・アニ鬼専用）", test: d => { const s = __famOf(d) + d.name; return /童子|鬼|羅刹|夜叉|温羅|悪路王|牛頭|馬頭|宿儺/.test(s) && !/鬼火|陰摩羅鬼|栄螺鬼|縊鬼|餓鬼|座敷童子/.test(s); } },
  hayashi: { label: "囃子の妖怪専用（本家：どんちゃん専用）", test: d => /狸囃子|家鳴り/.test(__famOf(d)) },
  umi: { label: "海の妖怪専用（本家：ワカメくん・コンブさん・メカブちゃん専用）", test: d => /人魚|磯女|濡れ女|海和尚|共潜き|蟹坊主|栄螺鬼/.test(__famOf(d)) },
  tsukumo: { label: "器物の妖怪専用（本家：ロボ妖怪専用）", test: d => /瀬戸大将|木魚達磨|琵琶牧々|琴古主|三味長老|文車妖妃|払子守|古籠火|化け草履|鳴釜|化け提灯|埴輪武者|鎧武者|面霊気/.test(__famOf(d)) || d.id === "karakasa" || d.id === "ittan" },
  muscle: { label: "力自慢の妖怪専用（本家：ブリー隊長専用）", test: d => /大入道|山男|見上げ入道/.test(__famOf(d)) },
  rankD: { label: "D ランク以下の妖怪専用", test: d => d.rank === "D" || d.rank === "E" },
  rankB: { label: "B ランク以下の妖怪専用", test: d => d.rank !== "S" && d.rank !== "A" },
};

var HONKE_EQUIP = [
  // うでわ（ちから）
  ["somatsu_udewa", "そまつなうでわ", "うでわ", { atk: 10, spd: -5 }],
  ["yasuppoi_udewa", "安っぽいうでわ", "うでわ", { atk: 10, def: -5 }],
  ["rock_udewa", "ロックなうでわ", "うでわ", { atk: 18, spd: -8 }],
  ["powerful_udewa", "パワフルなうでわ", "うでわ", { atk: 18, def: -8 }],
  ["chouriki_udewa", "超力のうでわ", "うでわ", { atk: 25, spd: -12 }],
  ["gouki_udewa", "豪気なうでわ", "うでわ", { atk: 25, def: -12 }],
  ["taiyou_udewa", "太陽のうでわ", "うでわ", { atk: 35, spd: -15 }],
  ["suisei_udewa", "彗星のうでわ", "うでわ", { atk: 35, def: -15 }],
  ["kishin_udewa", "鬼神のうでわ", "うでわ", { atk: 50, spd: -25 }],
  ["densetsu_udewa", "伝説のうでわ", "うでわ", { atk: 50, def: -25 }],
  // ゆびわ（ようりょく）
  ["sabita_yubiwa", "さびたゆびわ", "ゆびわ", { spa: 10, def: -5 }],
  ["dasai_yubiwa", "ダサいゆびわ", "ゆびわ", { spa: 10, spd: -5 }],
  ["pretty_ring", "プリティーリング", "ゆびわ", { spa: 18, def: -8 }],
  ["rainbow_ring", "レインボーリング", "ゆびわ", { spa: 18, spd: -8 }],
  ["genei_yubiwa", "げんえいのゆびわ", "ゆびわ", { spa: 25, def: -12 }],
  ["yousei_yubiwa", "妖精のゆびわ", "ゆびわ", { spa: 25, spd: -12 }],
  ["gekkou_yubiwa", "月光のゆびわ", "ゆびわ", { spa: 35, def: -15 }],
  ["unmei_yubiwa", "運命のゆびわ", "ゆびわ", { spa: 35, spd: -15 }],
  ["kishin_yubiwa", "鬼神のゆびわ", "ゆびわ", { spa: 50, def: -25 }],
  ["densetsu_yubiwa", "伝説のゆびわ", "ゆびわ", { spa: 50, spd: -25 }],
  // おまもり（まもり）
  ["furubita_omamori", "古びたおまもり", "おまもり", { def: 10, spa: -5 }],
  ["boroboro_omamori", "ボロボロなおまもり", "おまもり", { def: 10, atk: -5 }],
  ["rune_omamori", "ルーンのおまもり", "おまもり", { def: 18, spa: -8 }],
  ["kago_omamori", "加護のおまもり", "おまもり", { def: 18, atk: -8 }],
  ["teppeki_omamori", "てっぺきのおまもり", "おまもり", { def: 25, spa: -12 }],
  ["kouun_omamori", "幸運のおまもり", "おまもり", { def: 25, atk: -12 }],
  ["seiun_omamori", "星雲のおまもり", "おまもり", { def: 35, spa: -15 }],
  ["daichi_omamori", "大地のおまもり", "おまもり", { def: 35, atk: -15 }],
  ["kishin_omamori", "鬼神のおまもり", "おまもり", { def: 50, spa: -25 }],
  ["densetsu_omamori", "伝説のおまもり", "おまもり", { def: 50, atk: -25 }],
  // バッジ（すばやさ）
  ["simple_badge", "シンプルバッジ", "バッジ", { spd: 8, atk: -5 }],
  ["black_badge", "ブラックバッジ", "バッジ", { spd: 8, spa: -5 }],
  ["pikapika_badge", "ぴかぴかバッジ", "バッジ", { spd: 15, atk: -8 }],
  ["kawaii_badge", "かわいいバッジ", "バッジ", { spd: 15, spa: -8 }],
  ["hayate_badge", "はやてのバッジ", "バッジ", { spd: 20, atk: -12 }],
  ["aurora_badge", "オーロラバッジ", "バッジ", { spd: 20, spa: -12 }],
  ["ryusei_badge", "流星のバッジ", "バッジ", { spd: 30, atk: -15 }],
  ["raimei_badge", "雷鳴のバッジ", "バッジ", { spd: 30, spa: -15 }],
  ["kishin_badge", "鬼神のバッジ", "バッジ", { spd: 40, atk: -25 }],
  ["densetsu_badge", "伝説のバッジ", "バッジ", { spd: 40, spa: -25 }],
  // 専用装備
  ["semi_ninjatou", "セミ忍刀", "専用", { atk: 35, spd: 35 }, null, "ninja"],
  ["muscle_bell", "マッスルベル", "専用", { atk: 50 }, null, "cat"],
  ["magical_bell", "マジカルベル", "専用", { spa: 50 }, null, "cat"],
  ["tough_bell", "タフベル", "専用", { def: 50 }, null, "cat"],
  ["speed_bell", "スピードベル", "専用", { spd: 30 }, null, "cat"],
  ["mugen_suitou", "ムゲンすいとう", "専用", {}, { waterUp: 1250, waterGuard: 750 }, "kappa"],
  ["tengu_uchiwa", "天狗のうちわ", "専用", { spa: 100, spd: 100 }, null, "tengu"],
  ["happy_happi", "ハッピーはっぴ", "専用", { spd: 50 }, null, "umi"],
  ["kugi_bat", "釘バット", "専用", { atk: 50, def: -25 }, null, "oni"],
  ["donchan_bachi", "どんちゃんバチ", "専用", { def: 60, spa: 40 }, null, "hayashi"],
  ["robo_vitamin_e", "ロボビタミンＥ", "専用", { def: 45, spd: 20 }, null, "tsukumo"],
  ["burly_band", "ブリーバンド", "専用", { atk: 60 }, null, "muscle"],
  ["omoide_suzu", "思い出の鈴", "専用", { atk: 40, spd: 40 }, null, "jiba"],
  ["gyakuten_tsurugi", "逆転のつるぎ", "専用", { atk: 30, spd: 30 }, null, "rankD"],
  ["gyakuten_magatama", "逆転のまがたま", "専用", { spa: 30, spd: 30 }, null, "rankD"],
  ["gyakuten_kagami", "逆転のかがみ", "専用", { def: 30, spd: 30 }, null, "rankD"],
  ["gokuraku_dama", "極楽玉", "専用", { def: 50, spd: 50 }, null, "rankB"],
  // そのほか
  ["ganso_hachimaki", "元祖はちまき", "そのほか", {}, { vsCamp: "honke", mult: 1250 }],
  ["honke_hachimaki", "本家はちまき", "そのほか", {}, { vsCamp: "ganso", mult: 1250 }],
  ["haja_ofuda", "破邪のお札", "そのほか", {}, { vsMaga: 2000, vsOther: 800 }],
  ["jugon_katana", "呪言の刀", "呪言", { atk: 80, spd: -40 }, { critTaken: 4 }],
  ["jugon_tsue", "呪言の杖", "呪言", { spa: 80, spd: -40 }, { critTaken: 4 }],
  ["jugon_tate", "呪言の盾", "呪言", { def: 80, spd: -40 }, { cursedAllDown: 300 }],
  ["jugon_hakama", "呪言の袴", "呪言", { spd: 80, def: -40 }, { loafMult: 3 }],
  ["tekagen_belt", "てかげんベルト", "そのほか", {}, { allMult: 500 }],
  ["osaru_wakka", "おさるの輪っか", "そのほか", {}, { noBattleEffect: "進化しなくなる（対戦中は効果なし）" }],
  // 勲章（本家の通信対戦の称号。能力は変わらない）
  ["gensui_kunshou", "元帥の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
  ["sesshou_kunshou", "摂政の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
  ["kanpaku_kunshou", "関白の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
  ["udaijin_kunshou", "右大臣の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
  ["sadaijin_kunshou", "左大臣の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
  ["taishou_kunshou", "大将の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
  ["chuujou_kunshou", "中将の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
  ["shoushou_kunshou", "少将の勲章", "勲章", {}, { noBattleEffect: "通信対戦の称号（能力は変わらない）" }],
].map(([id, name, cat, mods, special, only]) => ({ id, name, cat, mods, special: special ?? null, only: only ?? null, honke: true }));

// ---- たべもの・どうぐ（対戦中に「アイテム」で使う） ----
// kind: heal（HP 回復）/ soul（妖気）/ talisman（能力を一時的に上げる）/ revive（気絶から復活）/ flee（逃げる）
var BATTLE_ITEMS = [
  // おにぎり
  ["umeonigiri", "うめおにぎり", "onigiri", 30], ["takanaonigiri", "たかなおにぎり", "onigiri", 40],
  ["ikuraonigiri", "いくらおにぎり", "onigiri", 80], ["aijoutenmusu", "あいじょう天むす", "onigiri", 150],
  // パン
  ["creampan", "クリームパン", "pan", 35], ["currypan", "カレーパン", "pan", 50], ["sandwich", "サンドイッチ", "pan", 60],
  ["francepan", "フランスパン", "pan", 100], ["akkanbagel", "アッカンベーグル", "pan", 150],
  // 駄菓子・チョコボー
  ["gum10", "10円ガム", "dagashi", 10], ["neriame", "ねりあめ", "dagashi", 15], ["ebisenbei", "大きなえびせんべい", "dagashi", 20],
  ["dropkan", "ドロップ缶", "dagashi", 35], ["kakigoori", "かき氷", "dagashi", 80], ["ringoame", "りんごあめ", "dagashi", 90],
  ["chocobo", "チョコボー", "chocobar", 30],
  // ハンバーガー
  ["hamburger", "ハンバーガー", "burger", 70], ["cheeseburger", "チーズバーガー", "burger", 90],
  ["doubleburger", "ダブルバーガー", "burger", 130], ["mogumoguburger", "モグモグバーガー", "burger", 200],
  // ラーメン
  ["cupramen", "カップラーメン", "ramen", 50], ["tonkotsu", "とんこつラーメン", "ramen", 110],
  ["chashumen", "チャーシューメン", "ramen", 160], ["specialramen", "スペシャルラーメン", "ramen", 230],
  // すし
  ["kappamaki", "かっぱ巻き", "sushi", 30], ["ebi", "エビ", "sushi", 70], ["ikuramaki", "いくら巻き", "sushi", 105], ["ootoro", "大トロ", "sushi", 170],
  // 中華
  ["gyouza", "ぎょうざ", "chuka", 50], ["rebanira", "レバニラ", "chuka", 70], ["kanitama", "カニ玉", "chuka", 100],
  ["ebichili", "エビチリ", "chuka", 140], ["healthymabo", "ヘルシーマーボー", "chuka", 180],
  // やさい
  ["ninjin", "にんじん", "yasai", 30], ["kyuuri", "きゅうり", "yasai", 30], ["takenoko", "たけのこ", "yasai", 130], ["matsutake", "まつたけ", "yasai", 600],
  // にく
  ["torimomo", "とりもも", "niku", 50], ["butabara", "豚バラブロック", "niku", 90], ["gyutan", "牛タン", "niku", 140], ["shimofuri", "特上しもふり", "niku", 900],
  // ぎょかい
  ["ajinohimono", "アジのひもの", "gyokai", 40], ["burinokirimi", "ブリの切り身", "gyokai", 70],
  ["shinsenuni", "しんせんなウニ", "gyokai", 240], ["gokujoumaguro", "ごくじょうマグロ", "gyokai", 750],
  // カレー
  ["namastecurry", "ナマステカレー", "curry", 130], ["chickencurry", "チキンカレー", "curry", 170], ["yasaicurry", "野菜ごろごろカレー", "curry", 180],
  ["muttoncurry", "マトンカレー", "curry", 200], ["seafoodcurry", "シーフードカレー", "curry", 220],
  // スイーツ
  ["gansomanjuu", "元祖まんじゅう", "sweets", 35], ["honkemanjuu", "本家まんじゅう", "sweets", 35], ["warabimochi", "わらびもち", "sweets", 45],
  ["cheesecake", "チーズケーキ", "sweets", 75], ["shortcake", "ショートケーキ", "sweets", 90], ["jumboparfait", "特大ジャンボパフェ", "sweets", 150],
  ["royalpancake", "ロイヤルパンケーキ", "sweets", 180],
  // おでん
  ["daikon", "ほっこりだいこん", "oden", 30], ["tamago", "味しみたまご", "oden", 30], ["gyusuji", "やわらか牛スジ", "oden", 45], ["gokujouoden", "極上おでん", "oden", 80],
  // スナック
  ["jagajaga", "じゃがじゃがチップス", "snack", 35], ["bariuma", "バリうまスナック", "snack", 50], ["dossari", "どっさりチーズコーン", "snack", 60], ["yukikakipea", "雪かきピー", "snack", 80],
  // そば
  ["zarusoba", "ざるそば", "soba", 130],
].map(([id, name, cat, amount]) => ({ id, name, kind: "heal", cat, amount }))
  .concat([
    // 牛乳・ジュース（妖気ゲージ。このゲームのゲージは 1000 で満タン）
    ["gyuunyuu", "牛乳", "milk", 30], ["coffeegyuunyuu", "コーヒー牛乳", "milk", 50], ["fruitsgyuunyuu", "フルーツ牛乳", "milk", 70], ["zeppingyuunyuu", "ぜっぴん牛乳", "milk", 180],
    ["yokacola", "ヨカコーラ", "juice", 30], ["youryokucha", "妖緑茶", "juice", 30], ["eiyoudrink", "栄妖ドリンク", "juice", 30], ["yokisimumgod", "ヨキシマムゴッド", "juice", 250],
  ].map(([id, name, cat, amount]) => ({ id, name, kind: "soul", cat, amount })))
  .concat([
    // おふだ（本家は「一時的に高める」。このゲームでは 15 秒のあいだ +30%）
    { id: "chikara_ofuda", name: "ちからのおふだ", kind: "talisman", stat: "atk", amount: 300, ticks: 300 },
    { id: "youryoku_ofuda", name: "ようりょくのおふだ", kind: "talisman", stat: "spa", amount: 300, ticks: 300 },
    { id: "mamori_ofuda", name: "まもりのおふだ", kind: "talisman", stat: "def", amount: 300, ticks: 300 },
    { id: "subayasa_ofuda", name: "すばやさのおふだ", kind: "talisman", stat: "spd", amount: 300, ticks: 300 },
    // 漢方（気絶した妖怪を復活）
    { id: "mazui_kanpou", name: "まず～い漢方", kind: "revive", amount: 250 },
    { id: "nigai_kanpou", name: "にが～い漢方", kind: "revive", amount: 500 },
    { id: "fukai_kanpou", name: "ふか～い漢方", kind: "revive", amount: 1000 },
    // みがわり人形（本家：バトルから逃げる）
    { id: "migawari_ningyou", name: "みがわり人形", kind: "flee" },
  ]);

var BAG_SIZE = 6;            // 持ち物は 6 つまで（同じものを重ねてもよい）
var ITEM_COOLDOWN = 100;     // アイテムを使ったあと、次に使えるまで 5 秒
var FAVORITE_MULT = 1250;    // 好物は 1.25 倍

function __famOf(d) {
  return typeof zi !== "undefined" && zi[d.id] ? zi[d.id].family : d.id;
}

function battleItem(id) {
  return BATTLE_ITEMS.find(x => x.id === id) ?? null;
}

function itemDesc(it) {
  switch (it.kind) {
    case "heal": return `HP を ${it.amount} 回復（好物「${FOOD_CATS[it.cat]}」なら 1.25 倍）`;
    case "soul": return `妖気を ${it.amount} ためる（好物「${FOOD_CATS[it.cat]}」なら 1.25 倍）`;
    case "talisman": return `${STAT_JA[it.stat]} を ${it.ticks / 20} 秒のあいだ +${it.amount / 10}%`;
    case "revive": return it.amount >= 1000 ? "気絶した妖怪を HP 満タンで復活" : `気絶した妖怪を HP ${it.amount / 10}% で復活`;
    case "flee": return "バトルから逃げる（引き分けあつかい）";
  }
  return "";
}

var STAT_JA = { hp: "HP", atk: "ちから", spa: "ようりょく", def: "まもり", spd: "すばやさ" };
