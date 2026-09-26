// ============================================================================
// 流行りの型（プリセット）。本家の対戦で流行った編成の「型」を、このゲームの妖怪で組んだもの。
// 役割（エース・とりつき役・挑発の壁・かばい手・照り返し・二度の踏ん張り…）と並びを本家の編成に合わせた。
// 本家のどの編成・どの妖怪に当たるかは docs/PRESETS.md（出典つき）に書く。
// 並び：最初の 3 体が前衛（左・まん中・右）、あとの 3 体が後衛。
// [名前, 性格, 持ち物, 育成]
// ============================================================================

var PRESETS = [
  {
    name: "エース強化・一撃必殺",
    desc: "全能力アップのとりつき役と挑発の壁でエースを守り、強化を重ねた会心の一撃で落とす。",
    tags: ["エース", "強化", "挑発"],
    team: [["面霊気", "devoted", null, "spa_spd"], ["飛縁魔大将", "fierce", "kishin_udewa", "atk_spd"], ["古蟹坊主", "stalwart", "teppeki_omamori", "hp_def"],
      ["虎熊童子大将", "fierce", "densetsu_udewa", "atk_spd"], ["五徳猫", "stalwart", null, "hp_def"], ["真石塔", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "ガード破り一点突破",
    desc: "ガードを無視する大物に強化を重ね、壁ごと打ち抜く。後ろの先駆けで最初の一手を早める。",
    tags: ["ガード破り", "強化", "先駆け"],
    team: [["面霊気", "devoted", null, "spa_spd"], ["酒呑童子", "fierce", "densetsu_udewa", "atk_spd"], ["古蟹坊主", "stalwart", "teppeki_omamori", "hp_def"],
      ["夜叉", "stalwart", null, "hp_def"], ["古馬頭", "fierce", "kishin_udewa", "atk_spd"], ["真石塔", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "全体妖術で一掃",
    desc: "ようりょくを上げるとりつきで術の妖怪を強め、全体の術で相手の前衛をまとめて削る。仙人が術の番を早める。",
    tags: ["全体術", "強化", "順送り"],
    team: [["古蟹坊主", "stalwart", "teppeki_omamori", "hp_def"], ["釣瓶火", "arcane", "kishin_yubiwa", "spa_spd"], ["子雷獣", "devoted", null, "spa_spd"],
      ["久米仙人", "devoted", null, "spa_spd"], ["豆管狐", "arcane", "densetsu_yubiwa", "spa_spd"], ["真石塔", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "鉄壁で耐えて削る",
    desc: "二度踏ん張る壁とかばい手で耐え、照り返しで術をはね返しながら鬼で削る。長期戦向き。",
    tags: ["耐久", "かばう", "照り返し"],
    team: [["鉄鼠大将", "stalwart", "teppeki_omamori", "hp_def"], ["鬼", "fierce", "densetsu_udewa", "atk_spd"], ["石妖王", "stalwart", "teppeki_omamori", "hp_def"],
      ["夜叉大将", "stalwart", null, "hp_def"], ["五徳猫", "stalwart", null, "hp_def"], ["琴古主", "stalwart", null, "hp_def"]],
  },
  {
    name: "不死身の粘り",
    desc: "まん中の要石で受け止め、後ろの回復役が毎回 HP を戻す。妖気を吸って相手の奥義を遅らせ、呪言の刀の一撃でしめる。",
    tags: ["回復", "妖気うばい", "呪言"],
    team: [["猫又", "hinder", null, "spa_spd"], ["山地乳王", "stalwart", "teppeki_omamori", "hp_def"], ["管狐", "hinder", null, "spa_spd"],
      ["豆霊亀", "devoted", null, "hp_def"], ["子白蛇", "devoted", null, "hp_def"], ["真悪路王", "fierce", "jugon_katana", "atk_spd"]],
  },
  {
    name: "三枚看板と城壁",
    desc: "まん中の仙人が両どなりの攻め手の番を早めて手数を増やす。油坊でホイールの待ちを縮め、城壁のような壁とすばやく入れかえる。",
    tags: ["手数", "順送り", "油差し"],
    team: [["鬼", "fierce", "densetsu_udewa", "atk_spd"], ["久米仙人", "devoted", null, "spa_spd"], ["飛縁魔大将", "fierce", "kishin_udewa", "atk_spd"],
      ["塗仏", "stalwart", "teppeki_omamori", "hp_def"], ["油坊", "devoted", null, "spa_spd"], ["塗仏", "stalwart", "teppeki_omamori", "hp_def"]],
  },
  {
    name: "壁と誘導・会心で決める",
    desc: "壁 2 体と油坊で守りを回しつつ、会心の鋭い天狗と鬼でサドンデスまでに一気に倒す。",
    tags: ["会心", "壁", "油差し"],
    team: [["鬼", "fierce", "densetsu_udewa", "atk_spd"], ["大蝦蟇", "stalwart", null, "hp_def"], ["大烏天狗", "fierce", "kishin_udewa", "atk_spd"],
      ["ぬりかべ", "stalwart", "teppeki_omamori", "hp_def"], ["油坊", "devoted", null, "spa_spd"], ["ぬりかべ", "stalwart", "teppeki_omamori", "hp_def"]],
  },
];

// プリセットを編成の形（teamMembers と同じ）にする。見つからない名前があれば null
function presetMembers(p) {
  const out = [];
  for (const [name, nature, equipment, effort] of p.team) {
    const d = ct.find(x => x.name === name);
    if (!d) return null;
    const m = { unit: d.id, nature, effortPreset: effort };
    if (equipment && equipAllowed(d, equipment)) m.equipment = equipment;
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
