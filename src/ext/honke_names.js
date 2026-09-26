// ============================================================================
// 本家の対戦で流行った編成に出てくる妖怪を、本家の名前・本家に寄せた見た目にする。
// 中身（能力値・特性・奥義）は、本家での役割にいちばん近かった妖怪のものを使う（対応は docs/PRESETS.md）。
// 赤鬼は本家の対戦での使われ方（ガードくずしで壁を貫通）に合わせて、特性をガード破りにする。
// [いまの名前, 本家の名前, 3D モデル（null ならいまのまま）]
// ============================================================================

var HONKE_UNITS = [
  ["面霊気", "ブリー隊長", ["hum", { build: "bulky", skin: 0xe8b890, torsoColor: 0x4a6a3a, sleeve: 0x4a6a3a, sash: 0xf2d15c, hat: "tokin", hair: "topknot", hairColor: 0x3a2a1a, eyeStyle: "angry", mouth: "open" }]],
  ["古蟹坊主", "マスクドニャーン", ["hum", { build: "slim", skin: 0xd9483b, headSize: 0.4, ears: "cat", mask: 0x2a6fd9, torsoColor: 0xf4f4f4, sash: 0xf2d15c, tail: "thin", tailN: 2, eyeStyle: "angry" }]],
  ["飛縁魔大将", "ブシニャン", ["hum", { build: "child", skin: 0xd9483b, headSize: 0.42, ears: "cat", hat: "crown", torsoColor: 0x4a4a5a, sleeve: 0x4a4a5a, sash: 0x2a2a34, weapon: "sword", tail: "thin", tailN: 2, eyeStyle: "round" }]],
  ["五徳猫", "肉くいおとこ", ["hum", { build: "fat", skin: 0xd9a070, pelt: 0x8a4a2a, hair: "wild", hairColor: 0x2a1a14, weapon: "club", eyeStyle: "round", mouth: "open" }]],
  ["虎熊童子大将", "オオクワノ神", ["quad", { skin: 0x2a1a14, belly: 0x4a3020, horns: "antler", long: !0, shortLegs: !0, snout: 0, ears: "none", eyeStyle: "glow", hat: "crown", size: 1.25 }]],
  ["鬼", "赤鬼", null],
  ["古馬頭", "さきがけの助", ["hum", { build: "slim", skin: 0xf1d9c4, hat: "kasa", hatColor: 0x8a6a3a, hair: "topknot", hairColor: 0x1c1820, torsoColor: 0xc8443a, sleeve: 0xc8443a, weapon: "spear", eyeStyle: "angry" }]],
  ["釣瓶火", "ミツマタノヅチ", ["serpent", { skin: 0x6a8a3a, segments: 12, eyeStyle: "slit", mane: 0xd9b24a, stripe: 0.18 }]],
  ["子雷獣", "ばか頭巾", ["ghost", { skin: 0x5a3a6a, headColor: 0xe07a2a, hat: "hood", hatColor: 0xe07a2a, eyeStyle: "glow", mouth: "fang", alpha: 0.95 }]],
  ["久米仙人", "ひとまか仙人", null],
  ["豆管狐", "草くいおとこ", ["hum", { build: "fat", skin: 0x9ac870, pelt: 0x3f8f5a, hat: "leaf", hair: "wild", hairColor: 0x2f5f3a, eyeStyle: "sleepy", mouth: "open" }]],
  ["鉄鼠大将", "ガマンモス", ["quad", { skin: 0x8a5a3a, trunk: !0, ears: "floppy", horns: "ox", mane: 0x5a3a2a, eyeStyle: "angry", size: 1.5, snout: 0.3 }]],
  ["大蝦蟇", "大ガマ", null],
  ["唐傘お化け", "から傘お化け", null],
  ["山地乳王", "黒鬼", ["hum", { build: "bulky", skin: 0x2a2a34, horns: 2, hair: "wild", hairColor: 0xd8d8d8, weapon: "club", pelt: 0xd9483b, eyeStyle: "glow", mouth: "fang" }]],
  ["土蜘蛛", "ドケチング", ["hum", { build: "fat", skin: 0xe8c04a, hat: "crown", robe: !0, cloth: 0x6a3a8a, sash: 0xd9b24a, eyeStyle: "angry", mouth: "smile" }]],
  ["管狐", "しどろもどろ", ["blob", { skin: 0x7ab8e0, eyeStyle: "sleepy", mouth: "open", tall: 1.1 }]],
  ["豆霊亀", "びきゃく", ["blob", { skin: 0xf2e6d0, eyeStyle: "round", mouth: "smile", size: 0.8, wide: 1.1 }]],
  ["真悪路王", "万尾獅子", ["quad", { skin: 0xe8b84a, mane: 0xd9483b, tail: "bushy", tails: 5, ears: "round", eyeStyle: "angry", mouth: "fang", size: 1.2 }]],
  ["塗仏", "むりだ城", ["stone", { shape: "wall", skin: 0x7a746a, feet: !0, eyeStyle: "angry" }]],
  ["油坊", "あせっか鬼", ["hum", { build: "child", skin: 0xe05a4a, horns: 1, blush: !0, mouth: "open", eyeStyle: "round", hair: "wild", hairColor: 0x1c1820 }]],
  ["ぬりかべ", "シロカベ", ["stone", { shape: "wall", skin: 0xefece2, feet: !0, eyeStyle: "sleepy" }]],
];
// ランクを本家に合わせる（出典の HRS の編成表に書かれたランク）。能力値はランクごとの平均の比で合わせる。
// 大ガマは本家では S だが、S が 3 体になる編成（赤鬼・大ガマ・ブシニャン）が組めなくなるので B のまま。
var HONKE_RANK = { ドケチング: "S", しどろもどろ: "B", びきゃく: "E", さきがけの助: "B", から傘お化け: "E" };
var RANK_MEAN = { S: [288, 120, 124, 111, 124], A: [252, 110, 111, 102, 113], B: [243, 101, 102, 96, 105], C: [231, 94, 93, 84, 100], D: [215, 83, 86, 81, 91], E: [195, 77, 76, 70, 94] };
for (const [from, to, model] of HONKE_UNITS) {
  const d = ct.find(x => x.name === from);
  if (!d) continue;
  const r = HONKE_RANK[to];
  if (r && r !== d.rank) {
    ["hp", "atk", "spa", "def", "spd"].forEach((k, i) => d[k] = Math.round(d[k] * RANK_MEAN[r][i] / RANK_MEAN[d.rank][i]));
    d.rank = r;
  }
  const fam = zi[d.id]?.family;
  for (const w of [from, fam].filter(Boolean)) d.ultName = d.ultName.split(w).join(to);
  d.name = to;
  if (model) d.honkeModel = model;
}
