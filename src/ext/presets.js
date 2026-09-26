// ============================================================================
// 流行りの型（プリセット）。本家の通信対戦で流行った編成（出典は docs/PRESETS.md）。
// 妖怪・並び・持ち物（装備・魂）は出典の編成どおり。
// 並び：最初の 3 体が前衛（左・まん中・右）、あとの 3 体が後衛。
// [名前, 性格（後半）, 持ち物]。性格の前半は、対戦でサボらないように全員「超まじめ」
// ============================================================================

var PRESETS = [
  {
    name: "ブシニャン特化",
    desc: "ブリー隊長の全能力アップのとりつきとエクササイズでブシニャンを強め、超クリティカルの会心で落とす。マスクドニャーンは猛虎のねばりで一度こらえる壁、オオクワノ神はいあつかんで敵味方のサボりを消すサブアタッカー。",
    tags: ["エース", "強化", "挑発"],
    team: [["ブリー隊長", "kyouryokuteki", null], ["ブシニャン", "arakure", "kishin_udewa"], ["マスクドニャーン", "doujinai", "teppeki_omamori"],
      ["オオクワノ神", "arakure", "densetsu_udewa"], ["肉くいおとこ", "doujinai", null], ["マスクドニャーン", "doujinai", "teppeki_omamori"]],
  },
  {
    name: "赤鬼特化",
    desc: "ガードくずしで壁ごと打ち抜く赤鬼に、ブリー隊長のとりつきで強化を重ねる。後ろの肉くいおとこは肉食オーラで敵味方がこうげきを選びやすくし、さきがけの助が削る。",
    tags: ["ガードくずし", "強化", "先駆け"],
    team: [["ブリー隊長", "kyouryokuteki", null], ["赤鬼", "arakure", "densetsu_udewa"], ["マスクドニャーン", "doujinai", "teppeki_omamori"],
      ["肉くいおとこ", "doujinai", null], ["さきがけの助", "arakure", "kishin_udewa"], ["マスクドニャーン", "doujinai", "teppeki_omamori"]],
  },
  {
    name: "ミツマタノヅチ特化",
    desc: "ばか頭巾のとりつきでミツマタノヅチのようりょくを上げ、全体の術で相手の前衛をまとめて削る。ひとまか仙人が術の番を早める。",
    tags: ["全体術", "強化", "ひとまかせ"],
    team: [["マスクドニャーン", "doujinai", "teppeki_omamori"], ["ミツマタノヅチ", "zunouteki", "kishin_yubiwa"], ["ばか頭巾", "kyouryokuteki", null],
      ["ひとまか仙人", "kyouryokuteki", null], ["草くいおとこ", "zunouteki", "densetsu_yubiwa"], ["マスクドニャーン", "doujinai", "teppeki_omamori"]],
  },
  {
    name: "猛攻ミツマタ対策",
    desc: "超ガマンで二度ふんばり、必殺技でまもりを上げて攻撃を集めるガマンモス 2 体と、味方をかばう大ガマで耐える。ブロッカー魂のから傘お化けはガードしながら前に出て術をはね返す。そのすきに赤鬼で削る。",
    tags: ["耐久", "ふんばり", "照り返し"],
    team: [["ガマンモス", "doujinai", "teppeki_omamori"], ["赤鬼", "arakure", "densetsu_udewa"], ["ガマンモス", "doujinai", "teppeki_omamori"],
      ["大ガマ", "doujinai", null], ["から傘お化け", "doujinai", "rsoul_blocker"], ["から傘お化け", "doujinai", "rsoul_blocker"]],
  },
  {
    name: "黒鬼ゾンビ",
    desc: "まん中でまもりが上がる黒鬼（におうだち）で受け止め、後ろのびきゃく（美脚）が前衛の HP を戻しつづける。ドケチングの毒の必殺技としどろもどろの全能力ダウンで削り、呪言の刀の万尾獅子でしめる。",
    tags: ["回復", "妖気うばい", "呪言"],
    team: [["ドケチング", "hidou", null], ["黒鬼", "doujinai", "teppeki_omamori"], ["しどろもどろ", "hidou", null],
      ["びきゃく", "kyouryokuteki", null], ["びきゃく", "kyouryokuteki", null], ["万尾獅子", "arakure", "jugon_katana"]],
  },
  {
    name: "赤鬼・ひとまか仙人・ブシニャン",
    desc: "まん中のひとまか仙人が両どなりの赤鬼・ブシニャンに番を回して手数を増やす。あせっか鬼でサークルの待ちを縮め、むりだ城とすばやく入れかえる。",
    tags: ["手数", "ひとまかせ", "なめらかオイル"],
    team: [["赤鬼", "arakure", "densetsu_udewa"], ["ひとまか仙人", "kyouryokuteki", null], ["ブシニャン", "arakure", "kishin_udewa"],
      ["むりだ城", "doujinai", "teppeki_omamori"], ["あせっか鬼", "kyouryokuteki", null], ["むりだ城", "doujinai", "teppeki_omamori"]],
  },
];

// プリセットを編成の形（teamMembers と同じ）にする。見つからない名前があれば null
function presetMembers(p) {
  const out = [];
  for (const [name, nature, equipment] of p.team) {
    const d = ct.find(x => x.name === name);
    if (!d) return null;
    const m = { unit: d.id, nature, diligence: "choumajime" };
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
  box.append(list, q("div", "b-rules-note", "押すと 6 体・並び・性格・持ち物をまとめて入れる。あとから自由に変えてよい。"));
  return box;
}
