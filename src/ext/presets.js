// ============================================================================
// 流行りの型（プリセット）。本家の通信対戦で流行った編成（出典は docs/PRESETS.md）。
// 妖怪・並び・持ち物は出典の編成どおり。魂は、このゲームの魂のうち同じ働きのものに置きかえた。
// 並び：最初の 3 体が前衛（左・まん中・右）、あとの 3 体が後衛。
// [名前, 性格, 持ち物, 育成]
// ============================================================================

var PRESETS = [
  {
    name: "ブシニャン特化",
    desc: "ブリー隊長の全能力アップとマスクドニャーンの挑発でブシニャンを守り、強化を重ねた一撃で落とす。オオクワノ神がサブアタッカー。",
    tags: ["エース", "強化", "挑発"],
    team: [["ブリー隊長", "devoted", null, "spa_spd"], ["ブシニャン", "fierce", "kishin_udewa", "atk_spd"], ["マスクドニャーン", "stalwart", "teppeki_omamori", "hp_def"],
      ["オオクワノ神", "fierce", "densetsu_udewa", "atk_spd"], ["肉くいおとこ", "stalwart", null, "hp_def"], ["マスクドニャーン", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "赤鬼特化",
    desc: "ガードくずしで壁ごと打ち抜く赤鬼に強化を重ねる。後ろのさきがけの助で最初の一手を早める。",
    tags: ["ガードくずし", "強化", "先駆け"],
    team: [["ブリー隊長", "devoted", null, "spa_spd"], ["赤鬼", "fierce", "densetsu_udewa", "atk_spd"], ["マスクドニャーン", "stalwart", "teppeki_omamori", "hp_def"],
      ["肉くいおとこ", "stalwart", null, "hp_def"], ["さきがけの助", "fierce", "kishin_udewa", "atk_spd"], ["マスクドニャーン", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "ミツマタノヅチ特化",
    desc: "ばか頭巾のとりつきでミツマタノヅチのようりょくを上げ、全体の術で相手の前衛をまとめて削る。ひとまか仙人が術の番を早める。",
    tags: ["全体術", "強化", "ひとまかせ"],
    team: [["マスクドニャーン", "stalwart", "teppeki_omamori", "hp_def"], ["ミツマタノヅチ", "arcane", "kishin_yubiwa", "spa_spd"], ["ばか頭巾", "devoted", null, "spa_spd"],
      ["ひとまか仙人", "devoted", null, "spa_spd"], ["草くいおとこ", "arcane", "densetsu_yubiwa", "spa_spd"], ["マスクドニャーン", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "猛攻ミツマタ対策",
    desc: "二度ふんばるガマンモス 2 体と大ガマで耐え、照り返しの魂を持ったから傘お化けで術をはね返しながら赤鬼で削る。",
    tags: ["耐久", "ふんばり", "照り返し"],
    team: [["ガマンモス", "stalwart", "teppeki_omamori", "hp_def"], ["赤鬼", "fierce", "densetsu_udewa", "atk_spd"], ["ガマンモス", "stalwart", "teppeki_omamori", "hp_def"],
      ["大ガマ", "stalwart", null, "hp_def"], ["から傘お化け", "stalwart", "soul:肉くいおとこ", "hp_def"], ["から傘お化け", "stalwart", "soul:肉くいおとこ", "hp_def"]],
  },
  {
    name: "黒鬼ゾンビ",
    desc: "まん中の黒鬼で受け止め、後ろのびきゃくが毎回 HP を戻す。ドケチングとしどろもどろで相手の力と妖気を削り、呪言の刀の万尾獅子でしめる。",
    tags: ["回復", "妖気うばい", "呪言"],
    team: [["ドケチング", "hinder", null, "spa_spd"], ["黒鬼", "stalwart", "teppeki_omamori", "hp_def"], ["しどろもどろ", "hinder", null, "spa_spd"],
      ["びきゃく", "devoted", null, "hp_def"], ["びきゃく", "devoted", null, "hp_def"], ["万尾獅子", "fierce", "jugon_katana", "atk_spd"]],
  },
  {
    name: "赤鬼・ひとまか仙人・ブシニャン",
    desc: "まん中のひとまか仙人が両どなりの赤鬼・ブシニャンに番を回して手数を増やす。あせっか鬼でサークルの待ちを縮め、むりだ城とすばやく入れかえる。",
    tags: ["手数", "ひとまかせ", "なめらかオイル"],
    team: [["赤鬼", "fierce", "densetsu_udewa", "atk_spd"], ["ひとまか仙人", "devoted", null, "spa_spd"], ["ブシニャン", "fierce", "kishin_udewa", "atk_spd"],
      ["むりだ城", "stalwart", "teppeki_omamori", "hp_def"], ["あせっか鬼", "devoted", null, "spa_spd"], ["むりだ城", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "赤鬼・大ガマ・ブシニャン",
    desc: "シロカベ 2 体とあせっか鬼で守りを回しつつ、赤鬼とブシニャンでサドンデスまでに一気に倒す。",
    tags: ["会心", "壁", "なめらかオイル"],
    team: [["赤鬼", "fierce", "densetsu_udewa", "atk_spd"], ["大ガマ", "stalwart", null, "hp_def"], ["ブシニャン", "fierce", "kishin_udewa", "atk_spd"],
      ["シロカベ", "stalwart", "teppeki_omamori", "hp_def"], ["あせっか鬼", "devoted", null, "spa_spd"], ["シロカベ", "stalwart", "teppeki_omamori", "hp_def"]],
  },
];

// プリセットを編成の形（teamMembers と同じ）にする。見つからない名前があれば null
function presetMembers(p) {
  const out = [];
  for (const [name, nature, equipment, effort] of p.team) {
    const d = ct.find(x => x.name === name);
    if (!d) return null;
    const m = { unit: d.id, nature, effortPreset: effort };
    // "soul:名前" はその妖怪の魂
    const eq = equipment?.startsWith("soul:") ? SOUL_PREFIX + (ct.find(x => x.name === equipment.slice(5))?.id ?? "") : equipment;
    if (eq && equipAllowed(d, eq)) m.equipment = eq;
    out.push(m);
  }
  return out;
}

// 編成画面の左に出す「流行りの型」
function presetBox(onApply) {
  const box = q("div", "b-rules b-presets");
  box.append(q("div", "b-rules-t", "流行りの型"));
  const list = q("div", "pre-list");
  for (const p of PRESETS) {
    const ms = presetMembers(p);
    if (!ms) continue;
    const b = q("button", "pre-item");
    const faces = q("span", "pre-faces");
    faces.innerHTML = ms.map(m => { const d = ct.find(x => x.id === m.unit); return `<span class="pre-face" style="background:${Pi[d.tribe]}">${da(d.id, d.name.slice(0, 1))}</span>`; }).join("");
    b.append(q("b", "", p.name), faces, q("small", "", p.tags.join("・")));
    b.title = `${p.desc}\n\n${ms.map((m, i) => `${i < 3 ? "前" : "後"} ${ct.find(x => x.id === m.unit).name}${m.equipment ? `（${equipById(m.equipment).name}）` : ""}`).join("\n")}`;
    b.onclick = () => {
      bt = ms.map(m => m.unit);
      loFromMembers(ms);
      onApply(p);
    };
    list.append(b);
  }
  box.append(list, q("div", "b-rules-note", "押すと 6 体・並び・性格・持ち物・育成をまとめて入れる。あとから自由に変えてよい。"));
  return box;
}
