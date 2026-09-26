// ============================================================================
// ホーム：上のタブで「対戦」「デッキ」「リプレイ」に分ける。
//   対戦   … いまのデッキを見て、CPU の強さを選んで対戦／対人戦のロビー／マイセットの入れかえ
//   デッキ … 編成画面（Sd）。6 体・性格・持ち物・アイテムを組む
//   リプレイ … 残した対戦の再生・振り返り・書き出し／読みこみ（replay_ui.js）
// ============================================================================
var HOME_TABS = [["battle", "対戦"], ["deck", "デッキ"], ["replay", "リプレイ"]];
var SCREEN_LEAVE = null; // いまの画面を離れるときの片づけ（キーの受け付けなど）

function homeShell(tab) {
  SCREEN_LEAVE?.(), SCREEN_LEAVE = null;
  Kr.replaceChildren();
  const h = q("h1", "", "妖怪大戦");
  h.append(q("small", "", "人 vs CPU・人 vs 人"));
  const nav = q("nav", "home-nav");
  nav.setAttribute("aria-label", "画面");
  for (const [id, label] of HOME_TABS) {
    const b = q("button", "nav-tab" + (id === tab ? " on" : ""), label);
    b.dataset.tab = id;
    b.setAttribute("aria-current", id === tab ? "page" : "false");
    b.onclick = () => { id !== tab && showHome(id); };
    nav.append(b);
  }
  Kr.append(h, Md(), nav);
}

// 開いたときにデッキが空なら、前の続き → なければおまかせ（編成画面と同じ）
function ensureDeck() {
  if (Ln().length || partyRestoreCurrent().ok) return;
  const m = s0(ni(Xl(), 77));
  bt = m.map(x => x.unit), loFromMembers(m.map(x => ({ ...x, diligence: "choumajime" })));
}

function showHome(tab = "battle") {
  saveStored("home:tab", tab);
  if (tab === "deck") return Sd();
  ensureDeck();
  homeShell(tab);
  const main = q("section", "home home-" + tab);
  Kr.append(main);
  if (tab === "replay") return renderReplayHome(main);
  renderBattleHome(main);
}

// ---- 対戦 ----
function deckFaces(ids, loadouts) {
  const row = q("div", "hm-deck");
  ids.forEach((id, i) => {
    const d = id ? ct.find(x => x.id === id) : null;
    const cell = q("div", "hm-mem" + (i < 3 ? " front" : ""));
    if (!d) { cell.append(q("span", "hm-pic empty", "＋"), q("b", "", "空き")); row.append(cell); return; }
    const pic = q("span", "hm-pic");
    pic.innerHTML = da(d.id, d.name.slice(0, 1)), pic.style.background = Pi[d.tribe];
    const eq = equipById(loadouts?.[i]?.equipment ?? null);
    cell.append(pic, q("b", "", d.name), q("small", "hm-eq" + (eq ? "" : " none"), eq ? eq.name : "持ち物なし"));
    cell.title = `${i < 3 ? "前衛" : "後衛"}・${d.name}（${d.rank}）`;
    row.append(cell);
  });
  return row;
}

function renderBattleHome(main) {
  const team = teamMembers(), bad = team.length === 6 ? Yn(team) : [`あと ${6 - team.length} 体`];
  // いまのデッキ
  const deck = q("div", "hm-card hm-deckcard");
  const head = q("div", "hm-head");
  head.append(q("span", "hm-t", "いまのデッキ"), q("span", "hm-sub", "前衛 3・後衛 3（ホイールの並び）"));
  const edit = q("button", "btn small hm-edit", "デッキを組む");
  edit.onclick = () => showHome("deck");
  head.append(edit);
  deck.append(head, deckFaces([0, 1, 2, 3, 4, 5].map(i => bt[i]), SLOT_LOADOUT));
  const bag = q("div", "hm-bag muted small", `アイテム：${BAG.length ? BAG.map(id => battleItem(id).name).join("・") : "なし"}（CPU 戦だけ）`);
  deck.append(bag);
  if (bad.length) deck.append(q("div", "hm-bad", `このデッキでは対戦できない：${bad.join(" / ")}`));
  // マイセットから入れる
  const sets = partyStore().slots.map((p, i) => [p, i]).filter(([p]) => p);
  if (sets.length) {
    const row = q("div", "hm-sets");
    row.append(q("span", "hm-lab", "マイセット"));
    for (const [p, i] of sets) {
      const b = q("button", "hm-set");
      const r = partyResolve(p);
      b.innerHTML = `<b>${p.name || `セット ${i + 1}`}</b><span class="ps-faces">${r.team.map(id => id ? da(id, "") : "").join("")}</span>`;
      b.title = "このセットをいまのデッキにする";
      b.onclick = () => { partyApply(p); showHome("battle"); };
      row.append(b);
    }
    deck.append(row);
  }
  main.append(deck);

  // CPU と対戦
  const cpu = q("div", "hm-card");
  cpu.append(q("div", "hm-t", "CPU と対戦"));
  const diff = q("div", "b-diff hm-diff");
  const rec = q("div", "b-rec");
  const drawRec = () => {
    const r = Rd(Ri);
    rec.innerHTML = `${or[Ri].name}：<b>${r.w}</b>勝 <b>${r.l}</b>敗${r.d ? ` ${r.d}分` : ""}　連勝 <b>${r.streak}</b>（最高 ${r.best}）`;
    diff.querySelectorAll("button").forEach(b => b.classList.toggle("on", Number(b.dataset.v) === Ri));
  };
  or.forEach((d, i) => {
    const b = q("button", "", d.name);
    b.dataset.v = String(i);
    b.onclick = () => { Ri = i, Td("diff", i), drawRec(); };
    diff.append(b);
  });
  const go = q("button", "btn primary hm-go home-cpu", "このデッキで対戦");
  go.disabled = bad.length > 0;
  go.onclick = () => openConfirm(teamMembers(), BAG.slice(), () => Fd(teamMembers(), BAG.slice()));
  cpu.append(q("div", "hm-lab", "相手の強さ"), diff, rec, go);
  drawRec();
  main.append(cpu);

  // 対人戦
  const pvp = q("div", "hm-card");
  pvp.append(q("div", "hm-t", "対人戦"));
  const r = Rd("pvp");
  const pr = q("div", "b-rec");
  pr.innerHTML = `対人戦：<b>${r.w}</b>勝 <b>${r.l}</b>敗${r.d ? ` ${r.d}分` : ""}　連勝 <b>${r.streak}</b>（最高 ${r.best}）`;
  pvp.append(q("div", "muted small", "ランダムマッチ・あいことばで友だちと。持ち物（装備）は効く・アイテムはなし"), pvpEntryButton(), pr);
  main.append(pvp);

  // さいきんの対戦（リプレイ）
  const recent = replayIndex().slice(0, 3);
  if (recent.length) {
    const box = q("div", "hm-card hm-recent");
    const hd = q("div", "hm-head");
    hd.append(q("span", "hm-t", "さいきんの対戦"));
    const all = q("button", "btn small", "リプレイをすべて見る");
    all.onclick = () => showHome("replay");
    hd.append(all);
    box.append(hd);
    for (const x of recent) box.append(replayRow(x, () => showHome("battle"), !0));
    main.append(box);
  }
}

// ---- デッキ：妖怪リストの並べかえ ----
// [id, ラベル, 値, 値をリストに出すか, 初めは大きい順か]
var RANK_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5 };
var UNIT_SORTS = [
  ["no", "No", d => d.no ?? ct.indexOf(d), !1, !1],
  ["name", "名前", d => d.kana || d.name, !1, !1],
  ["rank", "ランク", d => RANK_ORDER[d.rank] ?? 9, !1, !1],
  ["hp", "HP", d => d.hp, !0, !0],
  ["atk", "ちから", d => d.atk, !0, !0],
  ["spa", "ようりょく", d => d.spa, !0, !0],
  ["def", "まもり", d => d.def, !0, !0],
  ["spd", "すばやさ", d => d.spd, !0, !0],
  ["sum", "合計", d => d.hp + d.atk + d.spa + d.def + d.spd, !0, !0],
];
function unitSorted(list, key, rev) {
  const [, , val, , big] = UNIT_SORTS.find(z => z[0] === key) ?? UNIT_SORTS[0];
  const desc = big !== rev;
  return list.map((d, i) => ({ d, i, v: val(d) })).sort((a, b) => {
    const c = typeof a.v === "string" ? a.v.localeCompare(b.v, "ja") : a.v - b.v;
    return (desc ? -c : c) || a.i - b.i;
  }).map(x => x.d);
}
function unitSortDirLabel(key, rev) {
  const [, , , , big] = UNIT_SORTS.find(z => z[0] === key) ?? UNIT_SORTS[0];
  const desc = big !== rev;
  if (key === "name") return desc ? "ん→あ" : "あ→ん";
  if (key === "rank") return desc ? "E→S" : "S→E";
  if (key === "no") return desc ? "大→小" : "小→大";
  return desc ? "高い順 ↓" : "低い順 ↑";
}
