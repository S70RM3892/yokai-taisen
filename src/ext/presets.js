// ============================================================================
// 流行りの型（プリセット）。本家の通信対戦で流行った編成（出典は docs/PRESETS.md）。
// 妖怪・並び・そうび（装備・魂）は出典の編成どおり。
// 並び：最初の 3 体が前衛（左・まん中・右）、あとの 3 体が後衛。
// [名前, 性格（後半）, そうび]。性格の前半は、対戦でサボらないように全員「超まじめ」
// ============================================================================

var PRESETS = [
  {
    name: "ブシニャン特化",
    desc: "ブリー隊長の全能力アップのとりつきとエクササイズでブシニャンを強め、超クリティカルで落とす。マスクドニャーンは猛虎のねばりで一度こらえる壁、オオクワノ神はいあつかんで敵味方のサボりを消すサブアタッカー。",
    tags: ["エース", "強化", "ちょうはつ"],
    team: [["ブリー隊長", "kyouryokuteki", null], ["ブシニャン", "arakure", "kishin_udewa"], ["マスクドニャーン", "doujinai", "teppeki_omamori"],
      ["オオクワノ神", "arakure", "densetsu_udewa"], ["肉くいおとこ", "doujinai", null], ["マスクドニャーン", "doujinai", "teppeki_omamori"]],
  },
  {
    name: "赤鬼特化",
    desc: "ガードくずしで壁ごと打ち抜く赤鬼に、ブリー隊長のとりつきで強化を重ねる。後ろの肉くいおとこは肉食オーラで敵味方がこうげきを選びやすくし、さきがけの助が削る。",
    tags: ["ガードくずし", "強化", "さきがけ"],
    team: [["ブリー隊長", "kyouryokuteki", null], ["赤鬼", "arakure", "densetsu_udewa"], ["マスクドニャーン", "doujinai", "teppeki_omamori"],
      ["肉くいおとこ", "doujinai", null], ["さきがけの助", "arakure", "kishin_udewa"], ["マスクドニャーン", "doujinai", "teppeki_omamori"]],
  },
  {
    name: "ミツマタノヅチ特化",
    desc: "ばか頭巾のとりつきでミツマタノヅチのようりょくを上げ、全体の術で相手の前衛をまとめて削る。前に回したひとまか仙人は、自分の番をとなりの味方に任せて手数を増やす。",
    tags: ["全体ようじゅつ", "強化", "ひとまかせ"],
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
    desc: "まん中のひとまか仙人が自分の番を右どなりのブシニャン（倒れたら左の赤鬼）に任せて手数を増やす。あせっか鬼でサークルの待ちを縮め、むりだ城とすばやく入れかえる。",
    tags: ["手数", "ひとまかせ", "なめらかオイル"],
    team: [["赤鬼", "arakure", "densetsu_udewa"], ["ひとまか仙人", "kyouryokuteki", null], ["ブシニャン", "arakure", "kishin_udewa"],
      ["むりだ城", "doujinai", "teppeki_omamori"], ["あせっか鬼", "kyouryokuteki", null], ["むりだ城", "doujinai", "teppeki_omamori"]],
  },
];

// ============================================================================
// メタ候補（このゲームで考えた型）。本家の流行りではなく、このゲームの仕様（魂の効果・装備枠 2 つなど）で強くなるように組み、
// tools/meta_sim.mjs（いちばん強い CPU どうし・アイテムなし）で流行りの型・ほかの候補と総当たりさせて残したもの。
// [名前, 性格（後半）, そうび, そうび 2（装備枠が 2 つの妖怪だけ）]
// ============================================================================
var META_PRESETS = [
  { name: "ひとまかルビー", desc: "まん中のひとまか仙人が自分の番を右のブシニャン（倒れたら左の赤鬼）に任せて手数を増やす。ひとまか仙人と後衛のむりだ城 2 体にルビーニャンの魂を持たせ、前衛の 2 体に となりのちから +20% を 2 つずつ重ねる。あせっか鬼の装備 2 つで固くして、なめらかオイルでむりだ城と入れかえる。弱点：水の全体ようじゅつ（青鬼大雨）", tags: ["手数", "ひとまかせ", "ちから+40%"], rate: 89, team: [["赤鬼", "arakure", "densetsu_udewa"], ["ひとまか仙人", "kyouryokuteki", "soul:ルビーニャン"], ["ブシニャン", "arakure", "kishin_udewa"],
    ["むりだ城", "doujinai", "soul:ルビーニャン"], ["あせっか鬼", "kyouryokuteki", "teppeki_omamori", "teppeki_omamori"], ["むりだ城", "doujinai", "soul:ルビーニャン"]] },
  { name: "えんら速攻ブシニャン", desc: "まん中のブシニャンの両どなりに えんら系の魂（えんらえんら・エメラルニャン）を置いて、全体ひっさつわざを毎ターン +40 でためる。後衛のアライ魔将とミカンニャンも えんら系の魂で、回ってきた前衛の妖気をためつづける。オオクワノ神のいあつかんで敵味方のサボりを消す。弱点：ひとまかせの手数", tags: ["ひっさつわざ", "えんら魂", "全体"], rate: 65, team: [["マスクドニャーン", "doujinai", "soul:えんらえんら"], ["ブシニャン", "arakure", "kishin_udewa"], ["マスクドニャーン", "doujinai", "soul:エメラルニャン"],
    ["アライ魔将", "kyouryokuteki", "soul:ミカンニャン"], ["オオクワノ神", "arakure", "densetsu_udewa"], ["ミカンニャン", "kyouryokuteki", "soul:アライ魔将"]] },
  { name: "ミツマタ・メゾン", desc: "ミツマタノヅチ（ようじゅつが全体になる）の両どなりにメゾン・ドワスレの魂を置いて、ようりょく +40%。後衛のキュウビ（かんつう）と、前に回すと敵味方がこうげきを選びにくくなる草くいおとこで相手の攻め手を減らし、サファイニャンの魂で回ってきた前衛も強める。弱点：水の全体ようじゅつ", tags: ["全体ようじゅつ", "ようりょく+40%", "草食オーラ"], rate: 61, team: [["メゾン・ドワスレ", "doujinai", "soul:メゾン・ドワスレ"], ["ミツマタノヅチ", "zunouteki", "kishin_yubiwa"], ["ばか頭巾", "kyouryokuteki", "soul:メゾン・ドワスレ", "teppeki_omamori"],
    ["キュウビ", "zunouteki", "densetsu_yubiwa"], ["草くいおとこ", "zunouteki", "soul:サファイニャン"], ["ひとまか仙人", "kyouryokuteki", "soul:サファイニャン"]] },
  { name: "青鬼大雨", desc: "雨女の大雨で水の技が強くなり、青鬼（水あそび）とズルズルづる（水あそび・装備 2 つ）、にんぎょ・怪（大滝魂）で水のようじゅつを浴びせる。ズルズルづるのメゾン・ドワスレの魂で青鬼のようりょく +20%。火が弱点の赤鬼やキュウビに強い。弱点：雷（雷神ツートップ）", tags: ["水", "大雨", "ようじゅつ"], rate: 90, team: [["雨女", "doujinai", "teppeki_omamori"], ["青鬼", "zunouteki", "kishin_yubiwa"], ["ズルズルづる", "zunouteki", "rsoul_ootaki", "soul:メゾン・ドワスレ"],
    ["にんぎょ・怪", "zunouteki", "rsoul_ootaki"], ["雨ふらし", "zunouteki", "soul:サファイニャン"], ["河童・怪", "zunouteki", "densetsu_yubiwa"]] },
  { name: "おこ武者まん中", desc: "E ランクなのにちから 191 のおこ武者をまん中に置き、フユニャンの魂でまん中のちから +30%、両どなりのルビーニャンの魂で +40%。後ろに赤鬼を控えさせ、横綱うどん・トオセンボンの どひょうぎわ で一度こらえる。おこ武者は味方をなぐることがある（むしゃくしゃ）ので、そのぶん速く落とす。弱点：ひとまかせの手数", tags: ["ロースト", "まん中+30%", "ちから"], rate: 61, team: [["マスクドニャーン", "doujinai", "soul:ルビーニャン"], ["おこ武者", "arakure", "soul:フユニャン"], ["ブリー隊長", "kyouryokuteki", "soul:ルビーニャン"],
    ["横綱うどん", "doujinai", "teppeki_omamori"], ["赤鬼", "arakure", "densetsu_udewa"], ["トオセンボン", "doujinai", "teppeki_omamori"]] },
  { name: "怪魔ツートップ", desc: "ちから 205・まもり 171 の豪怪（超クリティカル）をまん中に、ブリー隊長とさきがけの助のルビーニャンの魂で ちから +40%。まもり 203 の厄怪を後ろに控えさせ、あせっか鬼の なめらかオイルで入れかえを速くする。弱点：ひとまかせの手数", tags: ["怪魔", "超クリティカル", "ちから+40%"], rate: 72, team: [["ブリー隊長", "kyouryokuteki", "soul:ルビーニャン"], ["豪怪", "arakure", "kishin_udewa"], ["さきがけの助", "arakure", "soul:ルビーニャン", "kishin_udewa"],
    ["厄怪", "doujinai", "teppeki_omamori"], ["あせっか鬼", "kyouryokuteki", "teppeki_omamori", "teppeki_omamori"], ["ふじのやま", "doujinai", "teppeki_omamori"]] },
  { name: "閃光二枚", desc: "閃光（1 度だけ先に動いて相手の番をとばす）のぬえ・風魔猿と雷蔵（閃光）を前に、閃光魂のさきがけの助、せっかち・爆速のまてんし・ばくそくを後ろに置いて、回すたびに先手をとる。雷のようじゅつで水の型にも強い。弱点：ちからの高いまん中（おこ武者まん中）", tags: ["閃光", "先手", "雷"], rate: 60, team: [["ぬえ", "zunouteki", "kishin_yubiwa"], ["風魔猿", "zunouteki", "densetsu_yubiwa"], ["雷蔵", "arakure", "rsoul_senkou"],
    ["ばくそく", "arakure", "kishin_udewa"], ["まてんし", "arakure", "kishin_udewa"], ["さきがけの助", "arakure", "kishin_udewa", "rsoul_senkou"]] },
  { name: "雷神ツートップ", desc: "ようりょく 181 の風魔猿と 171 の破怪（ガードくずし）で雷のようじゅつを撃つ。でんぱく小僧・ヒライ神・U.S.O. のメゾン・ドワスレの魂で ようりょくを重ね、ヒライ神（避雷針）は相手の雷を吸いとる。水の型（青鬼大雨）にとても強い。弱点：ひとまかせの手数", tags: ["雷", "ようりょく", "水対策"], rate: 78, team: [["でんぱく小僧", "zunouteki", "soul:メゾン・ドワスレ"], ["風魔猿", "zunouteki", "kishin_yubiwa"], ["破怪", "zunouteki", "densetsu_yubiwa"],
    ["ヒライ神", "zunouteki", "soul:メゾン・ドワスレ"], ["でんじん", "zunouteki", "kishin_yubiwa"], ["U.S.O.", "doujinai", "soul:メゾン・ドワスレ"]] },
  { name: "キュウビかんつう", desc: "キュウビ（かんつう：相手の耐性を無視）の全体ひっさつわざを、両どなりのメゾン・ドワスレの魂とえんらえんらのスキル（妖気のけむり）で速く強く撃つ。後衛のミツマタノヅチでも全体ようじゅつ。弱点：水（キュウビは水が弱点）", tags: ["全体", "かんつう", "えんら魂"], rate: 76, team: [["ムリカベ", "doujinai", "soul:メゾン・ドワスレ"], ["キュウビ", "zunouteki", "kishin_yubiwa"], ["えんらえんら", "zunouteki", "soul:メゾン・ドワスレ"],
    ["横綱うどん", "doujinai", "teppeki_omamori"], ["ミツマタノヅチ", "zunouteki", "kishin_yubiwa"], ["トオセンボン", "doujinai", "soul:えんらえんら"]] },
  { name: "二刀流エース", desc: "装備を 2 つ持てるさきがけの助（鬼神＋伝説のうでわ）と、まん中のブリー隊長（エクササイズ＋ルビーニャンの魂）で ちからを重ね、右の赤鬼がガードくずしで打ちぬく。後衛のアペリカン・のっぺら坊も装備 2 つでルビーニャンの魂を持ち、回ってきた前衛を強める。万尾獅子は呪言の刀＋鬼神のうでわで ちから +130。弱点：水の全体ようじゅつ", tags: ["装備 2 つ", "ちから", "ガードくずし"], rate: 67, team: [["さきがけの助", "arakure", "kishin_udewa", "densetsu_udewa"], ["ブリー隊長", "kyouryokuteki", "soul:ルビーニャン"], ["赤鬼", "arakure", "densetsu_udewa"],
    ["アペリカン", "kyouryokuteki", "soul:ルビーニャン", "teppeki_omamori"], ["万尾獅子", "arakure", "jugon_katana", "kishin_udewa"], ["のっぺら坊", "doujinai", "soul:ルビーニャン", "densetsu_omamori"]] },
];

// プリセットを編成の形（teamMembers と同じ）にする。見つからない名前があれば null
function presetMembers(p) {
  const out = [];
  for (const [name, nature, equipment, equipment2] of p.team) {
    const d = ct.find(x => x.name === name);
    if (!d) return null;
    const m = { unit: d.id, nature, diligence: "choumajime" };
    // "soul:名前" はその妖怪の魂
    const eq = equipment?.startsWith("soul:") ? SOUL_PREFIX + (ct.find(x => x.name === equipment.slice(5))?.id ?? "") : equipment;
    if (eq && equipAllowed(d, eq)) m.equipment = eq;
    const eq2 = equipment2?.startsWith("soul:") ? SOUL_PREFIX + (ct.find(x => x.name === equipment2.slice(5))?.id ?? "") : equipment2;
    if (eq2 && equipSlots(d) === 2 && equipAllowed(d, eq2)) m.equipment2 = eq2;
    out.push(m);
  }
  return out;
}

// 編成画面の左に出す「流行りの型」（本家）と「メタ候補」（このゲームで考えた型）
function presetBox(onApply, meta = false) {
  const box = q("div", "b-rules b-presets" + (meta ? " b-meta" : ""));
  box.append(q("div", "b-rules-t", meta ? "メタ候補（このゲームで考えた型）" : "流行りの型"));
  const list = q("div", "pre-list");
  for (const p of meta ? META_PRESETS : PRESETS) {
    const ms = presetMembers(p);
    if (!ms) continue;
    const b = q("button", "pre-item");
    const faces = q("span", "pre-faces");
    faces.innerHTML = ms.map(m => { const d = ct.find(x => x.id === m.unit); return `<span class="pre-face" style="background:${Pi[d.tribe]}">${da(d.id, d.name.slice(0, 1))}</span>`; }).join("");
    b.append(q("b", "", p.name + (p.rate ? `　勝率 ${p.rate}%` : "")), faces, q("small", "", p.tags.join("・")));
    b.title = `${p.desc}\n\n${ms.map((m, i) => `${i < 3 ? "前" : "後"} ${ct.find(x => x.id === m.unit).name}${m.equipment || m.equipment2 ? `（${equipNames(m)}）` : ""}`).join("\n")}`;
    b.onclick = () => {
      bt = ms.map(m => m.unit);
      loFromMembers(ms);
      onApply(p);
    };
    list.append(b);
  }
  box.append(list, q("div", "b-rules-note", meta
    ? "本家の流行りではなく、このゲームの魂・装備 2 つなどを使って組んだ型。勝率は いちばん強い CPU どうし・アイテムなしで 流行りの型・ほかの候補・ランダムな編成と戦わせた目安（tools/meta_sim.mjs）。人どうしだと変わる。"
    : "押すと 6 体・並び・性格・そうびをまとめて入れる。あとから自由に変えてよい。"));
  return box;
}
