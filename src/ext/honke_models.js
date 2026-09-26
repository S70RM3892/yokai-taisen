// ============================================================================
// 本家の妖怪（honke_roster.js）の 3D モデル。
// 1 体ずつ手で形を決める代わりに、名前にふくまれる言葉（ニャン・鬼・天狗・カッパ・蛇・鳥・姫・爺…）と
// 種族から体つきを選び、色（赤鬼・ルビーニャン・メロンニャンなどは名前の色）と飾りを 1 体ずつ変える。
// ============================================================================

var HONKE_COLOR_WORDS = [
  [/赤|レッド|ルビー|イチゴ|紅|アカ/, 0xd9483b], [/青|ブルー|サファイ|アオ/, 0x3b6fd9], [/黒|ダーク|ヤミ|闇|クロ|影/, 0x2e2a3a],
  [/白|シロ|ホワイト|ダイヤ|雪/, 0xefeee8], [/金|ゴールド|キン|ゴルニャン|黄金/, 0xe8c04a], [/銀|ギン|シルバー|プラチナ/, 0xc8ccd6],
  [/緑|グリーン|エメラル|メロン|草|葉/, 0x4fa65a], [/ヒカリ|光|トパ|黄/, 0xf2d15c], [/ピンク|桃|サクラ|キュン|モテ|ハート/, 0xf29ac0],
  [/紫|ブドウ/, 0x7a4ab0], [/ミカン|オレンジ|炎|火|メラ|ほむら/, 0xf08a2a], [/キウイ|土|砂|泥/, 0x9a7a4a],
  [/スイカ/, 0x3f8f4a], [/氷|こおり|ふぶき|さむ|つらら|あられ/, 0xaad8f0], [/ロボ|メカ|鉄|くろがね/, 0x8a94a8],
];

// よく知られた妖怪は本家の色に寄せる
var HONKE_NAME_COLOR = { ジバニャン: 0xd9483b, ワルニャン: 0xc8443a, ブチニャン: 0xf2eee4, トゲニャン: 0x4a3a6a, コマさん: 0xf4f4f0, コマじろう: 0xf4f4f0,
  ししコマ: 0xe8c04a, とらじろう: 0xe8a040, キュウビ: 0xf2e6d0, フユニャン: 0x6ab8e8, ロボニャン: 0x3a6ab8, ダークニャン: 0x2e2a3a, ノガッパ: 0x5aa55a,
  セミまる: 0x6a8a3a, カゲまる: 0x3a3a4a, ウィスパー: 0xf4f4f4, おでんじん: 0xe8c04a, ヨロイさん: 0x8a8a90, ガブニャン: 0x7a3a8a };
function honkeColor(name, tribe, h) {
  if (HONKE_NAME_COLOR[name] !== void 0) return HONKE_NAME_COLOR[name];
  for (const [re, c] of HONKE_COLOR_WORDS) if (re.test(name)) return shade(c, ((h >> 4) % 20 - 10) / 100);
  const base = { takeru: 10, ayashi: 265, tsuwamono: 40, kage: 330, nagomi: 110, miyabi: 200, tatari: 285, shizume: 170, maga: 350 }[tribe] ?? 0;
  return hslHex(base + (h % 70) - 35, 0.45 + (h >> 7) % 30 / 100, 0.45 + (h >> 11) % 20 / 100);
}

// [正規表現, (色, 乱数) → [形, 設定]]。上から順に最初に当たったもの
var HONKE_SHAPES = [
  [/ニャン|猫|ネコ|ニャ$/, (c, h, n) => ["hum", { build: "child", skin: c, headSize: 0.42, ears: "cat", tail: "thin", tailN: 2, tailColor: c, eyeStyle: h % 3 ? "round" : "angry", blush: h % 2 === 0, weapon: h % 5 === 0 ? "sword" : void 0, hat: h % 7 === 0 ? "crown" : void 0 }]],
  [/ロボ/, (c, h, n) => ["hum", { build: "bulky", skin: 0x8a94a8, torsoColor: c, sleeve: c, horns: 1, hornColor: 0xe8c04a, eyeStyle: "glow", mouth: "none", headSize: 0.4 }]],
  [/天狗|テング/, (c, h, n) => ["hum", { build: "bulky", skin: c, nose: "long", wings: shade(c, -0.4), hat: "tokin", weapon: "fan", hair: "wild", hairColor: 0xf4f4f4, eyeStyle: "angry" }]],
  [/ガッパ|カッパ|河童/, (c, h, n) => ["hum", { build: "child", skin: 0x5aa55a, dish: !0, hair: "wild", hairColor: 0x2f5f3a, shell: shade(c, -0.2), head: "bird", beak: 0xf2c14a }]],
  [/鬼|オニ|おに/, (c, h, n) => ["hum", { build: h % 3 ? "bulky" : "fat", skin: c, horns: h % 4 ? 2 : 1, hair: "wild", hairColor: 0x1c1820, weapon: ["club", "club", "mallet", "sword"][h % 4], pelt: 0xf2d15c, eyeStyle: "angry", mouth: "fang" }]],
  [/獅子|ライオン|コマ|ガルル|ベロス|トラ|とら|虎|麒麟|イッカク/, (c, h, n) => ["quad", { skin: c, mane: shade(c, -0.3), ears: "round", tail: "bushy", eyeStyle: h % 2 ? "angry" : "round", mouth: "fang", horns: /麒麟|イッカク/.test(n) ? "one" : void 0, size: 1 + (h % 3) * 0.1, snout: 0.35 }]],
  [/犬|ドッグ|ワン|いぬ|イヌ|ウルフ|ワン/, (c, h, n) => ["quad", { skin: c, ears: "floppy", tail: "bushy", snout: 0.45, eyeStyle: "round", size: 0.9 + (h % 3) * 0.1 }]],
  [/ムカデ|カデ/, (c, h, n) => ["serpent", { skin: c, legs: "centipede", segments: 13, eyeStyle: "angry", stripe: 0.2 }]],
  [/オロチ|ヅチ|龍|竜|ドラゴン|りゅー|リュウ|ウナギ|ウツボ|蛇|スネーク|ジャ|へび|ヘビ|ノコ/, (c, h, n) => ["serpent", { skin: c, segments: 10 + h % 4, horns: /龍|竜|ドラゴン|オロチ/.test(n) || h % 2 === 0, whiskers: h % 3 === 0, mane: h % 2 ? shade(c, 0.3) : void 0, eyeStyle: "slit", stripe: 0.15 }]],
  [/蝶|チョウ/, (c, h, n) => ["bird", { skin: c, crest: shade(c, 0.3), eyeStyle: "round", wingColor: shade(c, 0.2) }]],
  [/鳥|ドリ|ギス|カモ|コウモリ|ペリカン|トリ|カラス|ホギス|ハト|ツバメ|ホーク|イーグル|ヒヨコ|ワシ/, (c, h, n) => ["bird", { skin: c, crest: shade(c, -0.3), eyeStyle: h % 2 ? "angry" : "round" }]],
  [/サメ|ザメ|ギョ|ウオ|クジラ|うお|魚|タイ|フグ|マグロ/, (c, h, n) => ["critter", { kind: "fish", skin: c, size: 1 + (h % 3) * 0.1 }]],
  [/カニ|シェル|貝|ツボ|ウニ|イガ|トゲ|センボン|ハリ/, (c, h, n) => ["critter", { kind: /カニ/.test(n) ? "crab" : "shell", skin: c, shell: shade(c, -0.2), size: 1 }]],
  [/カエル|える|ガマ|がま/, (c, h, n) => ["critter", { kind: "frog", skin: c, size: 1 }]],
  [/ヤモリ|トカゲ|もり/, (c, h, n) => ["critter", { kind: "lizard", skin: c, size: 1 }]],
  [/クモ|蜘蛛|ぐも/, (c, h, n) => ["critter", { kind: "spider", skin: c, size: 1.1 }]],
  [/カブト|クワガ|クワノ|ツノ|ゲンマ|ゲンスイ|武者|武士|侍|ブシ|将軍|大将|ベンケイ|やまと|むらまさ|まさむね|くさなぎ|だんびら|刀|サムライ/, (c, h, n) => ["hum", { build: h % 2 ? "bulky" : "slim", skin: 0xf1d9c4, torsoColor: c, sleeve: c, hat: h % 3 ? "kasa" : "crown", hatColor: shade(c, -0.3), horns: /カブト|クワガ|クワノ|ツノ/.test(n) ? 2 : void 0, weapon: h % 3 ? "sword" : "spear", eyeStyle: "angry", hair: "topknot" }]],
  [/傘/, (c, h, n) => ["object", { thing: "umbrella", skin: c }]],
  [/車|しゃ$|ワゴン/, (c, h, n) => ["object", { thing: "wheel", skin: c }]],
  [/釜|なべ|鍋/, (c, h, n) => ["object", { thing: "kettle", skin: c }]],
  [/壺|土器|ドキ|つぼ/, (c, h, n) => ["object", { thing: "pottery", skin: c }]],
  [/鏡|カガミ/, (c, h, n) => ["object", { thing: "mask", skin: c }]],
  [/城|カベ|ぬりかべ|壁/, (c, h, n) => ["stone", { shape: "wall", skin: c, feet: !0, eyeStyle: "angry" }]],
  [/石|岩|ぼっち|山|砂|だるま|ダルマ|カク|ロック/, (c, h, n) => ["stone", { shape: h % 3 ? "boulder" : "haniwa", skin: c, eyeStyle: ["angry", "sleepy", "round"][h % 3] }]],
  [/火|炎|ほむら|メラ|あつ|ひばな|ボーボ|もえ/, (c, h, n) => ["flame", { skin: c, eyeStyle: h % 2 ? "angry" : "round", orbs: h % 3 }]],
  [/雪|氷|こおり|ふぶき|さむ|あられ|つらら/, (c, h, n) => ["hum", { build: "slim", skin: 0xf4f7ff, robe: !0, cloth: c, hair: "long", hairColor: 0x20243a, eyeStyle: "sleepy", sash: shade(c, 0.3) }]],
  [/姫|婦人|女|お姉|ギャル|ババ|婆|バア|花子|夫人|おんな|ねえ|娘|リーナ|オカン|オバア|比丘尼|イザナミ|ナース|母|ママ|くちびる|姉/, (c, h, n) => ["hum", { build: "slim", skin: 0xf6e2d2, robe: !0, cloth: c, hair: ["long", "bun", "bob"][h % 3], hairColor: h % 4 ? 0x1c1820 : 0xe8e8e8, eyeStyle: h % 2 ? "sleepy" : "round", blush: !0, sash: shade(c, 0.35) }]],
  [/爺|じじい|じぃ|じい|老師|和尚|僧|師$|仙人|オトン|翁|入道|親方|伯爵|議長|男/, (c, h, n) => ["hum", { build: h % 2 ? "fat" : "slim", skin: 0xe8d6bc, hair: h % 3 ? "wild" : "topknot", hairColor: 0xf2f2f2, robe: h % 2 === 0, cloth: c, torsoColor: c, sash: shade(c, 0.3), weapon: h % 3 === 0 ? "staff" : void 0, eyeStyle: "sleepy" }]],
  [/モチ|餅|おにぎり|飯|丼|うどん|まんじゅう|パン|ケーキ|豆|のり|こめ|ビ$|キビ/, (c, h, n) => ["blob", { skin: c, eyeStyle: h % 2 ? "round" : "sleepy", mouth: h % 2 ? "smile" : "open", arms: !0, size: 0.9 }]],
  [/霊|ゆうれい|幽|ゴースト|影|カゲ|やみ|ヤミ|ネガ|ドンヨリ|ジミ|おばけ|魂|怨/, (c, h, n) => ["ghost", { skin: c, headColor: shade(c, 0.4), eyeStyle: h % 2 ? "glow" : "sleepy", mouth: h % 3 ? "open" : "smile", wisps: shade(c, 0.4), alpha: 0.9 }]],
  [/小僧|坊|ボーイ|くん|太$|丸$|童|ぼう|キッズ|ちゃん|さん$|犬$/, (c, h, n) => ["hum", { build: "child", skin: 0xf6e2d2, torsoColor: c, hair: ["bob", "wild", "topknot"][h % 3], hairColor: 0x1c1820, eyeStyle: "round", blush: h % 2 === 0, mouth: h % 2 ? "smile" : "open" }]],
];

// 本家の種族ごとの体つき（名前から決まらなかったとき）
function honkeTribeShape(tribe, c, h) {
  switch (tribe) {
    case "takeru": return ["hum", { build: "bulky", skin: 0xf1d9c4, torsoColor: c, sleeve: c, hair: "topknot", hairColor: 0x1c1820, weapon: ["sword", "spear", "club"][h % 3], eyeStyle: "angry" }];
    case "ayashi": return ["ghost", { skin: c, headColor: shade(c, 0.35), eyeStyle: "round", mouth: "open", wisps: shade(c, 0.4), alpha: 0.92 }];
    case "tsuwamono": return ["hum", { build: "fat", skin: c, hair: "wild", hairColor: shade(c, -0.5), weapon: h % 2 ? "club" : void 0, eyeStyle: "angry", mouth: "open" }];
    case "kage": return ["quad", { skin: c, ears: h % 2 ? "cat" : "round", tail: h % 2 ? "thin" : "bushy", snout: 0.3, eyeStyle: "round", size: 0.85 }];
    case "nagomi": return ["blob", { skin: c, eyeStyle: "round", mouth: "smile", arms: !0, blush: !0 }];
    case "miyabi": return ["ghost", { skin: c, headColor: shade(c, 0.5), eyeStyle: "sleepy", mouth: "smile", alpha: 0.8 }];
    case "tatari": return ["ghost", { skin: shade(c, -0.3), headColor: c, eyeStyle: "glow", mouth: "fang", wisps: 0x9a5ad0, alpha: 0.9 }];
    case "shizume": return ["serpent", { skin: c, segments: 11, eyeStyle: "round", stripe: 0.12 }];
    case "maga": return ["hum", { build: "bulky", skin: shade(c, -0.35), horns: 2, hornColor: 0x3a1a1a, hair: "wild", hairColor: 0x1a1016, eyeStyle: "glow", mouth: "fang", pelt: c }];
  }
  return ["blob", { skin: c }];
}

// 流行りの型に出てくる妖怪など、1 体ずつ手で形を決めた妖怪（名前から自動で決めるより本家に近い）
var HONKE_NAME_MODEL = {
  化け草履: ["object", { thing: "sandal", skin: 0xc8a878 }],
  天狗: ["hum", { build: "bulky", skin: 0xc8443a, nose: "long", wings: 0x3f8f5a, hat: "tokin", weapon: "fan", hair: "wild", hairColor: 0xf4f4f4, eyeStyle: "angry" }],
  河童: ["hum", { build: "child", skin: 0x5aa55a, dish: !0, hair: "wild", hairColor: 0x2f5f3a, shell: 0x6b8f3a, head: "bird", beak: 0xf2c14a }],
  ろくろ首: ["hum", { build: "slim", skin: 0xf1d9c4, longNeck: !0, robe: !0, cloth: 0xc75b8a, hair: "bun", hairColor: 0x20243a, eyeStyle: "sleepy" }],
  ブリー隊長: ["hum", { build: "bulky", skin: 0xe8b890, torsoColor: 0x4a6a3a, sleeve: 0x4a6a3a, sash: 0xf2d15c, hat: "tokin", hair: "topknot", hairColor: 0x3a2a1a, eyeStyle: "angry", mouth: "open" }],
  マスクドニャーン: ["hum", { build: "slim", skin: 0xd9483b, headSize: 0.4, ears: "cat", mask: 0x2a6fd9, torsoColor: 0xf4f4f4, sash: 0xf2d15c, tail: "thin", tailN: 2, eyeStyle: "angry" }],
  ブシニャン: ["hum", { build: "child", skin: 0xd9483b, headSize: 0.42, ears: "cat", hat: "crown", torsoColor: 0x4a4a5a, sleeve: 0x4a4a5a, sash: 0x2a2a34, weapon: "sword", tail: "thin", tailN: 2, eyeStyle: "round" }],
  肉くいおとこ: ["hum", { build: "fat", skin: 0xd9a070, pelt: 0x8a4a2a, hair: "wild", hairColor: 0x2a1a14, weapon: "club", eyeStyle: "round", mouth: "open" }],
  オオクワノ神: ["quad", { skin: 0x2a1a14, belly: 0x4a3020, horns: "antler", long: !0, shortLegs: !0, snout: 0, ears: "none", eyeStyle: "glow", hat: "crown", size: 1.25 }],
  赤鬼: ["hum", { build: "bulky", skin: 0xd9483b, horns: 2, hair: "wild", hairColor: 0x1c1820, weapon: "club", pelt: 0xf2d15c, eyeStyle: "angry", mouth: "fang" }],
  さきがけの助: ["hum", { build: "slim", skin: 0xf1d9c4, hat: "kasa", hatColor: 0x8a6a3a, hair: "topknot", hairColor: 0x1c1820, torsoColor: 0xc8443a, sleeve: 0xc8443a, weapon: "spear", eyeStyle: "angry" }],
  ミツマタノヅチ: ["serpent", { skin: 0x6a8a3a, segments: 12, eyeStyle: "slit", mane: 0xd9b24a, stripe: 0.18 }],
  ばか頭巾: ["ghost", { skin: 0x5a3a6a, headColor: 0xe07a2a, hat: "hood", hatColor: 0xe07a2a, eyeStyle: "glow", mouth: "fang", alpha: 0.95 }],
  ひとまか仙人: ["hum", { build: "slim", skin: 0xe8d6bc, hair: "long", hairColor: 0xf2f2f2, robe: !0, cloth: 0x5a7ec8, sash: 0xe8c04a, weapon: "staff", eyeStyle: "sleepy", hat: "tokin", headSize: 0.36 }],
  草くいおとこ: ["hum", { build: "fat", skin: 0x9ac870, pelt: 0x3f8f5a, hat: "leaf", hair: "wild", hairColor: 0x2f5f3a, eyeStyle: "sleepy", mouth: "open" }],
  ガマンモス: ["quad", { skin: 0x8a5a3a, trunk: !0, ears: "floppy", horns: "ox", mane: 0x5a3a2a, eyeStyle: "angry", size: 1.5, snout: 0.3 }],
  大ガマ: ["critter", { kind: "frog", skin: 0x7a6a3a, size: 1.3 }],
  から傘お化け: ["object", { thing: "umbrella", skin: 0x7a5bc4 }],
  黒鬼: ["hum", { build: "bulky", skin: 0x2a2a34, horns: 2, hair: "wild", hairColor: 0xd8d8d8, weapon: "club", pelt: 0xd9483b, eyeStyle: "glow", mouth: "fang" }],
  ドケチング: ["hum", { build: "fat", skin: 0xe8c04a, hat: "crown", robe: !0, cloth: 0x6a3a8a, sash: 0xd9b24a, eyeStyle: "angry", mouth: "smile" }],
  しどろもどろ: ["blob", { skin: 0x7ab8e0, eyeStyle: "sleepy", mouth: "open", tall: 1.1 }],
  びきゃく: ["blob", { skin: 0xf2e6d0, eyeStyle: "round", mouth: "smile", size: 0.8, wide: 1.1 }],
  万尾獅子: ["quad", { skin: 0xe8b84a, mane: 0xd9483b, tail: "bushy", tails: 5, ears: "round", eyeStyle: "angry", mouth: "fang", size: 1.2 }],
  むりだ城: ["stone", { shape: "wall", skin: 0x7a746a, feet: !0, eyeStyle: "angry" }],
  あせっか鬼: ["hum", { build: "child", skin: 0xe05a4a, horns: 1, blush: !0, mouth: "open", eyeStyle: "round", hair: "wild", hairColor: 0x1c1820 }],
  シロカベ: ["stone", { shape: "wall", skin: 0xefece2, feet: !0, eyeStyle: "sleepy" }],
};

function honkeAutoModel(def) {
  if (HONKE_NAME_MODEL[def.name]) return HONKE_NAME_MODEL[def.name];
  const h = hash32("hm:" + def.name), c = honkeColor(def.name, def.tribe, h);
  const nm = def.name.replace(/・怪$/, "");
  for (const [re, f] of HONKE_SHAPES) if (re.test(nm)) {
    const [plan, o] = f(c, h, nm);
    // 怪魔（・怪）は暗く、目を光らせる
    if (def.tribe === "maga") o.skin = shade(o.skin ?? c, -0.3), o.eyeStyle = "glow";
    return [plan, Object.fromEntries(Object.entries(o).filter(([, v]) => v !== void 0))];
  }
  return honkeTribeShape(def.tribe, c, h);
}
