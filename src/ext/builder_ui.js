// ============================================================================
// 編成画面の「確認」まわり：
//   ・選んだ妖怪の 3D モデル・能力値（装備こみ）・特性・好物などをその場で見る
//   ・性格（本家の前半＝まじめさ／後半＝行動の傾向）と持ち物（装備・魂）をえらぶ
//   ・アイテム（対戦で使うたべもの・どうぐ）をえらぶ
//   どの選ぶ画面も、効果の大きい順などに並べかえ・種類でしぼりこみができる
//   ・「けってい」のあと、出陣前に 6 体と持ち物をまとめて確認する
// bt（ホイールの 6 枠の妖怪）と同じ並びで SLOT_LOADOUT（枠ごとの持ち物）を持つ。
// ============================================================================

function defaultLoadout() { return { nature: null, diligence: null, equipment: null }; }
var SLOT_LOADOUT = loadStored("loadout", null)?.slice?.(0, 6) ?? [0, 1, 2, 3, 4, 5].map(defaultLoadout);
while (SLOT_LOADOUT.length < 6) SLOT_LOADOUT.push(defaultLoadout());
var BAG = validBag(loadStored("bag", ["ikuraonigiri", "cheeseburger", "tonkotsu", "nigai_kanpou", "coffeegyuunyuu", "chikara_ofuda"]));
var DETAIL_FOR = null; // リストで見ているだけの妖怪（枠に入れる前の確認）

function loadStored(key, fb) {
  try { const v = localStorage.getItem("yokai-taisen:" + key); return v === null ? fb : JSON.parse(v); } catch { return fb; }
}
function saveStored(key, v) {
  try { localStorage.setItem("yokai-taisen:" + key, JSON.stringify(v)); } catch {}
}
function saveLoadout() { saveStored("loadout", SLOT_LOADOUT); saveStored("bag", BAG); }

function memberAt(i) {
  if (!bt[i]) return null;
  const lo = SLOT_LOADOUT[i] ?? defaultLoadout();
  const d = ct.find(x => x.id === bt[i]);
  const m = { unit: bt[i] };
  if (lo.nature) try { m.nature = natureId(lo.nature); } catch {}
  if (lo.diligence) m.diligence = diligenceOf(lo.diligence).id;
  if (lo.equipment && equipAllowed(d, lo.equipment)) m.equipment = lo.equipment;
  return m;
}
function teamMembers() { return [0, 1, 2, 3, 4, 5].map(memberAt).filter(Boolean); }

// ---- ホイールの並びが変わったとき、持ち物もいっしょに動かす ----
function loRotate(step) { const old = SLOT_LOADOUT.slice(); SLOT_LOADOUT = old.map((_, i) => old[(i - step + 6) % 6]); saveLoadout(); }
function loSwap(a, b) { [SLOT_LOADOUT[a], SLOT_LOADOUT[b]] = [SLOT_LOADOUT[b], SLOT_LOADOUT[a]]; saveLoadout(); }
function loReset(i) { SLOT_LOADOUT[i] = defaultLoadout(); saveLoadout(); }
function loFromMembers(members) { SLOT_LOADOUT = members.map(m => ({ nature: m.nature ?? null, diligence: m.diligence ?? null, equipment: m.equipment ?? null })); saveLoadout(); }

var STAT_ROWS = [["maxHp", "hp", "HP"], ["atk", "atk", "ちから"], ["spa", "spa", "ようりょく"], ["def", "def", "まもり"], ["spd", "spd", "すばやさ"]];

function statTable(d, st) {
  const max = { maxHp: 420, atk: 280, spa: 280, def: 280, spd: 260 };
  return `<div class="st-table">${STAT_ROWS.map(([k, b, label]) => {
    const base = d[b], v = st[k], diff = v - base;
    return `<span class="st-l">${label}</span><span class="st-bar"><i style="width:${Math.min(100, v * 100 / max[k])}%"></i>${diff ? `<b class="${diff > 0 ? "up" : "down"}" style="left:${Math.min(100, Math.min(v, base) * 100 / max[k])}%;width:${Math.abs(diff) * 100 / max[k]}%"></b>` : ""}</span><span class="st-v num">${v}${diff ? `<small class="${diff > 0 ? "up" : "down"}">${diff > 0 ? "+" : ""}${diff}</small>` : ""}</span>`;
  }).join("")}</div>`;
}

// くわしい情報（3D・能力値・特性・持ち物えらび）
function renderDetail(host, slot, onChange) {
  const viewing = DETAIL_FOR && DETAIL_FOR !== bt[slot] ? DETAIL_FOR : null;
  const id = viewing ?? bt[slot];
  host.replaceChildren();
  if (!id) { host.append(q("div", "muted", "この枠は空き。右のリストから選ぶと、ここに 3D モデルとくわしい能力が出る。")); return; }
  const d = ct.find(x => x.id === id);
  const lo = viewing ? defaultLoadout() : SLOT_LOADOUT[slot];
  const member = viewing ? { unit: id } : memberAt(slot);
  const st = memberStats(member);
  const tr = traitOf(d);
  const eq = equipById(member.equipment ?? null);

  const top = q("div", "dt-top");
  const view = q("div", "dt-3d");
  top.append(view);
  const info = q("div", "dt-info");
  info.innerHTML = `<div class="dt-name"><b>${d.name}</b> <span class="rank ${d.rank}">${d.group ? d.rank + "・鬼（1 体まで）" : d.rank}</span></div>
    <div class="tag">${Hl[d.tribe]}族・${st.camp ? CAMP_JA[st.camp] + "・" : ""}${st.favorite ? `好物「${FOOD_CATS[st.favorite]}」` : "好物なし"}</div>
    <div class="tag">妖気ランク ${d.sgRank}・サボり ${Math.round(d.loafPermil / 10)}%</div>
    ${viewing ? '<div class="dt-note">リストで見ているところ。枠に入れるには、もう一度押す。</div>' : ""}`;
  top.append(info);
  host.append(top);
  showPreview(view, d);

  host.insertAdjacentHTML("beforeend", statTable(d, st));
  const hk = d.trait === "honke";
  const skillLine = d.skillMode === "heal" ? `回復・威力 ${d.skillPower}（味方を回復）` : d.skillMode === "drain" ? `吸収・威力 ${d.skillPower}（与えたダメージの半分を回復）` : `${d.skillElement ? Gl[d.skillElement] : "無"}・威力 ${d.skillPower}`;
  const inspLine = hk ? (d.inspKind === "bless" ? `${Ad[d.blessing]}${Bn[d.inspTier] ?? ""}（味方）` : `${Wl[d.curse]}${Bn[d.inspTier] ?? ""}（相手）`) : `${Wl[d.curse]}（相手）／${Ad[d.blessing]}（味方）`;
  host.insertAdjacentHTML("beforeend", `<div class="dt-trait"><div class="dt-h">${hk ? "スキル" : "特性"}「${tr.name}」</div><div>${tr.desc}</div>${hk && tr.detail && !tr.fx.noBattle ? `<div class="dt-note">このゲームでは：${tr.detail}</div>` : ""}</div>
    <div class="dt-moves">
      <div><span class="dt-k">こうげき</span> ${hk ? d.attackName + "・" : ""}威力 ${d.attackPower}${d.attackHits > 1 ? `（${d.attackHits} 回に分けて当たる）` : ""}</div>
      <div><span class="dt-k">ようじゅつ</span> ${hk ? d.skillName + "・" : ""}${skillLine}</div>
      <div><span class="dt-k">とりつく</span> ${hk ? d.inspName + "・" : ""}${inspLine}</div>
      <div><span class="dt-k">ひっさつわざ</span> ${d.ultName}${ultDesc(d.ult)}</div>
      <div><span class="dt-k">弱点・耐性</span> ${d.weak ? Gl[d.weak] : "なし"}／${d.resist ? Gl[d.resist] : "なし"}</div>
    </div>`);
  if (viewing) return;

  // えらぶところ（押すと、並べかえできる選ぶ画面が開く）
  const form = q("div", "dt-form");
  const pickRow = (label, value, note, open) => {
    const row = q("div", "dt-row");
    const b = q("button", "dt-pick");
    b.innerHTML = `<span>${value}</span><i>▾</i>`;
    b.onclick = open;
    row.append(q("span", "dt-k", label), b);
    if (note) row.append(q("span", "dt-note", note));
    form.append(row);
    return b;
  };
  pickRow("性格", natureFullName(st.nature, st.diligence) + (lo.nature ? "" : "（初めの性格）"),
    `${qn(st.nature).kind}・${natureBonusText(st.nature)}・${natureDesc(st.nature)}`,
    () => openNaturePicker(d, lo, (nat, dil) => { SLOT_LOADOUT[slot].nature = nat; SLOT_LOADOUT[slot].diligence = dil; saveLoadout(); onChange(); }));
  pickRow("持ち物", eq ? eq.name : "なし", eq ? equipDesc(eq) + (equipGameText(eq) ? `（このゲームでは：${equipGameText(eq)}）` : "") : "装備なし",
    () => openEquipPicker(d, lo.equipment, id => { SLOT_LOADOUT[slot].equipment = id; saveLoadout(); onChange(); }));
  host.append(form);
}

function natureBonusText(id) {
  return "ボーナス " + Object.entries(qn(id).bonus).map(([k, v]) => `${STAT_JA[k]}+${k === "hp" ? v * wh : v}`).join("・");
}

var ACT_JA = ["こうげき", "ようじゅつ", "ガード", "とりつく(敵)", "とりつく(味方)"];
function natureDesc(id) {
  const n = qn(id), names = ACT_JA;
  return n.weights.map((w, i) => w ? `${names[i]} ${w}%` : null).filter(Boolean).join("・");
}

function ultDesc(u) {
  const x = [];
  if (u.power && ["single", "all", "heal"].includes(u.kind)) x.push(`威力 ${u.power}`);
  if (u.cancel) x.push("当たると相手の奥義の構えを解く");
  if (u.curse) x.push(`${Wl[u.curse]}にすることがある`);
  if (u.gamble) x.push("会心が出やすいが外れやすい");
  else if (u.crit) x.push("会心が出やすい");
  if (u.recoil) x.push("反動でダメージを受ける");
  if (u.randPow) x.push("威力が毎回変わる");
  if (u.drain) x.push("与えたダメージの半分を回復");
  if (u.blast) x.push("味方の前衛にも当たる");
  if (u.selfKo) x.push("使うと自分は気絶");
  if (u.full) x.push("HP を全回復");
  if (u.bless) x.push(`${Ad[u.bless]}もつける`);
  if (u.purify) x.push("おはらいもする");
  return ultKindDesc(u) + (x.length ? `・${x.join("・")}` : "");
}
function ultKindDesc(u) {
  switch (u.kind) {
    case "single": return `（相手 1 体に${u.element ? Gl[u.element] + "の" : ""}大ダメージ）`;
    case "break": return "（ガードを破る大ダメージ）";
    case "all": return `（相手の前衛全員に${u.element ? Gl[u.element] + "の" : ""}ダメージ）`;
    case "heal": return "（味方の前衛全員を回復）";
    case "curseAll": return `（相手の前衛全員を${Wl[u.curse]}に）`;
    case "blessAll": return `（味方の前衛全員に${Ad[u.blessing]}）`;
    case "selfBless": return "（まもりを上げて、相手の攻撃を自分に集める）";
    case "dispel": return "（相手のよいとりつきを消す）";
    case "purifyAll": return "（味方全員をおはらい）";
    case "revive": return "（気絶した味方を復活）";
  }
  return "";
}

// 持ち物（左の列）
function renderBag(host, onChange) {
  host.replaceChildren(q("div", "b-rules-t", `アイテム（${BAG.length}/${BAG_SIZE}）`));
  const list = q("div", "bag-list");
  BAG.forEach((id, i) => {
    const it = battleItem(id);
    const row = q("div", "bag-item");
    row.title = itemDesc(it);
    row.append(q("span", "bag-ic " + it.kind, itemIcon(it)), q("span", "bag-nm", it.name));
    const x = q("button", "bag-x", "×");
    x.title = "外す";
    x.onclick = () => { BAG.splice(i, 1); saveLoadout(); onChange(); };
    row.append(x);
    list.append(row);
  });
  host.append(list);
  const add = q("button", "b-mini save", "＋ アイテムを入れる");
  add.disabled = BAG.length >= BAG_SIZE;
  add.onclick = () => openItemPicker(id => { if (BAG.length < BAG_SIZE) BAG.push(id); saveLoadout(); onChange(); });
  host.append(add, q("div", "b-rules-note", "CPU 戦で、右下の「アイテム」で使う。好物なら 1.25 倍。対人戦はアイテムなし。"));
}

// ---- 選ぶ画面（性格・持ち物・アイテムで共通） ----
// 種類でしぼる「タブ」と、効果の大きい順などに並べる「ならべかえ」を持つ。最後に使ったタブと並べ方は覚えておく。
//   o.key      覚えておくときの名前
//   o.tabs     [[id, ラベル, (it) => 出すか]]
//   o.sorts    [[id, ラベル, (it) => 並べる値 | null（元の順）, 小さい順なら true]]
//   o.card     (it, sortId) => { html, cls }   o.onPick(it) が true を返すと開いたまま
function openSortPicker(o) {
  const pref = loadStored("pick:" + o.key, {});
  let tab = o.tabs.some(t => t[0] === pref.tab) ? pref.tab : o.tabs[0][0];
  let sort = o.sorts.some(t => t[0] === pref.sort) ? pref.sort : o.sorts[0][0];
  let hide = o.hide ? pref.hide !== !1 : !1; // 「効果のないものをかくす」は初めは入れておく
  const wrap = q("div", "result picker");
  const box = q("div", "box");
  // 上（見出し・いまの持ち物・しぼりこみ・ならべかえ）は止めて、下の一覧だけスクロールする
  const top = q("div", "pk-top");
  const titleRow = q("div", "pk-title");
  const title = q("div", "title");
  const x = q("button", "pk-x", "×");
  x.title = "とじる（Esc）";
  x.setAttribute("aria-label", "とじる");
  titleRow.append(title, x);
  const current = q("div", "pk-cur");
  top.append(titleRow, current);
  if (o.head) top.append(o.head);
  const tabs = q("div", "pk-row pk-scroll");
  const sorts = q("div", "pk-row pk-scroll");
  const tools = q("div", "pk-tools");
  const search = o.search ? q("input", "b-search") : null;
  if (search) { search.placeholder = "名前・効果でさがす"; search.type = "search"; search.oninput = () => draw(); tools.append(search); }
  const hideBtn = o.hide ? q("button", "pk-chip pk-toggle") : null;
  if (hideBtn) { hideBtn.onclick = () => { hide = !hide; remember(); draw(); }; tools.append(hideBtn); }
  for (const btn of o.actions ?? []) tools.append(btn);
  const count = q("div", "pk-count");
  const body = q("div", "pick-grid pk-body");
  const done = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") done(); };
  x.onclick = done;
  const remember = () => saveStored("pick:" + o.key, { tab, sort, hide });
  const chips = (host, list, cur, set, counts) => {
    host.replaceChildren();
    for (const [id, label] of list) {
      const n = counts?.(id);
      const b = q("button", "pk-chip" + (id === cur ? " on" : "") + (n === 0 ? " empty" : ""), counts ? `${label} ${n}` : label);
      b.setAttribute("aria-pressed", id === cur);
      b.onclick = () => { set(id); remember(); draw(); };
      host.append(b);
    }
    host.querySelector(".on")?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const draw = () => {
    title.textContent = typeof o.title === "function" ? o.title() : o.title;
    const cur = o.current?.();
    current.hidden = !cur;
    if (cur) current.innerHTML = cur;
    if (hideBtn) {
      const n = o.items.filter(it => o.hide.test(it)).length;
      hideBtn.textContent = `${hide ? "✓ " : ""}${o.hide.label}（${n}）`;
      hideBtn.classList.toggle("on", hide);
      hideBtn.setAttribute("aria-pressed", hide);
    }
    const word = search?.value.trim() ?? "";
    const hit = it => (!word || o.search(it).includes(word)) && !(hide && o.hide.test(it));
    chips(tabs, o.tabs, tab, v => (tab = v), id => o.items.filter(o.tabs.find(t => t[0] === id)[2]).filter(hit).length);
    chips(sorts, o.sorts.map(([id, label]) => [id, label]), sort, v => (sort = v));
    const [, , key, asc] = o.sorts.find(t => t[0] === sort);
    let list = o.items.filter(o.tabs.find(t => t[0] === tab)[2]).filter(hit).map((it, i) => ({ it, i, v: key(it) }));
    list.sort((a, b) => {
      if (a.v == null || b.v == null) return (a.v == null) - (b.v == null) || a.i - b.i;
      const c = typeof a.v === "string" ? a.v.localeCompare(b.v, "ja") : a.v - b.v;
      return (asc ? c : -c) || a.i - b.i;
    });
    count.textContent = `${list.length} 件`;
    body.replaceChildren();
    body.scrollTop = 0;
    if (!list.length) body.append(q("div", "muted", word ? `「${word}」に当てはまるものがない` : "当てはまるものがない"));
    for (const { it } of list) {
      const c = o.card(it, sort);
      const b = q("button", "pick-item " + (c.cls ?? ""));
      b.innerHTML = c.html;
      if (c.title) b.title = c.title;
      b.onclick = () => { if (o.onPick(it)) draw(); else done(); };
      body.append(b);
    }
  };
  top.append(q("div", "pk-lab", "しぼりこみ"), tabs, q("div", "pk-lab", "ならべかえ"), sorts);
  if (tools.childElementCount) top.append(tools);
  top.append(count);
  box.append(top, body);
  wrap.append(box);
  wrap.onclick = e => { if (e.target === wrap) done(); };
  document.addEventListener("keydown", onKey);
  document.body.append(wrap);
  draw();
  body.querySelector(".cur")?.scrollIntoView?.({ block: "center" });
  return { draw, close: done };
}

function deltaChips(delta, hi) {
  return STAT_ROWS.map(([k, , label]) => delta[k] ? `<span class="pk-d ${delta[k] > 0 ? "up" : "down"}${k === hi ? " hi" : ""}">${label}${delta[k] > 0 ? "+" : ""}${delta[k]}</span>` : "").join("");
}

// 性格：前半（まじめさ）はチップ、後半（行動の傾向）はカードから選ぶ
var NATURE_SORTS = [
  ["order", "本家の順", () => null],
  ...ACT_JA.map((label, i) => ["w" + i, label + "が多い", n => n.weights[i]]),
  ...STAT_ROWS.map(([, b, label]) => ["b_" + b, label + "ボーナス", n => (n.bonus[b] ?? 0) * (b === "hp" ? wh : 1)]),
];
var NATURE_TABS = [
  ["all", "すべて", () => !0],
  ["attack", "こうげき系", n => n.weights[0] >= 60],
  ["skill", "ようじゅつ系", n => n.weights[1] >= 40],
  ["curse", "とりつく（じゃま）", n => n.weights[3] >= 45],
  ["bless", "とりつく（味方）・回復", n => n.weights[4] >= 30],
  ["guard", "ガード系", n => n.weights[2] >= 40],
];

function openNaturePicker(d, lo, onPick) {
  let dil = diligenceOf(lo.diligence).id;
  let nat = lo.nature ? natureId(lo.nature) : null;
  const head = q("div", "pk-head");
  const dilRow = q("div", "pk-row");
  const drawDil = () => {
    dilRow.replaceChildren();
    for (const x of DILIGENCE) {
      const b = q("button", "pk-chip" + (x.id === dil ? " on" : ""), `${x.name}（サボり ${Math.round(d.loafPermil * x.mult / 10 * 10) / 10}%）`);
      b.onclick = () => { dil = x.id; onPick(nat, dil); drawDil(); };
      dilRow.append(b);
    }
  };
  drawDil();
  const reset = q("button", "b-mini save", `初めの性格にもどす（${qn(d.defaultNature).name}）`);
  reset.onclick = () => { nat = null; onPick(null, dil); p.draw(); };
  head.append(q("div", "pk-lab", "前半：まじめさ（サボりやすさ）"), dilRow, q("div", "pk-lab", "後半：行動の傾向と性格ボーナス（本家：対戦のたびに合計 20 まで伸びる。ここでは伸びきった値）"), reset);
  const p = openSortPicker({
    key: "nature", title: `${d.name} の性格`, head, items: $n, tabs: NATURE_TABS, sorts: NATURE_SORTS,
    card: (n, sort) => {
      const delta = Object.fromEntries(STAT_ROWS.map(([k, b]) => [k, (n.bonus[b] ?? 0) * (b === "hp" ? wh : 1)]));
      const cur = (nat ?? natureId(d.defaultNature)) === n.id;
      const bars = n.weights.map((w, i) => `<span class="pk-w${sort === "w" + i ? " hi" : ""}"><em>${ACT_JA[i]}</em><i style="width:${w}%"></i><b>${w}%</b></span>`).join("");
      const hi = sort.startsWith("b_") ? STAT_ROWS.find(r => r[1] === sort.slice(2))[0] : null;
      return {
        cls: "pk-card" + (cur ? " cur" : ""),
        html: `<span class="pk-main"><b>${n.name}</b><small>${n.kind}${d.defaultNature && natureId(d.defaultNature) === n.id ? "・初めの性格" : ""}</small>
          <span class="pk-ws">${bars}</span><span class="pk-ds">${deltaChips(delta, hi)}</span></span>`,
      };
    },
    onPick: n => { nat = n.id; onPick(n.id, dil); return !1; },
  });
}

// 持ち物（装備・魂）：この妖怪に付けたときの能力の変化で並べられる
var EQUIP_TABS = [
  ["all", "装備すべて", e => e.cat !== "魂" && e.cat !== "レア魂"],
  ["rare", "レア魂", e => e.cat === "レア魂"],
  ["soul", "魂", e => e.cat === "魂"],
  ...["うでわ", "ゆびわ", "おまもり", "バッジ", "専用", "呪言", "そのほか", "勲章"].map(c => [c, c, e => e.cat === c]),
];

// 対戦で何も起きない持ち物（本家では効果があるが、このゲームの対戦にはない）
function equipNoEffect(e) {
  if (!e) return !1;
  const hasMods = e.mods && Object.values(e.mods).some(v => v);
  if (e.cat === "魂" || e.cat === "レア魂") return !hasMods && (!e.fx || !!e.fx.noBattle || !Object.keys(e.fx).length);
  return !hasMods && !!e.special?.noBattleEffect;
}
// 魂・レア魂の、このゲームでの効き方（本家の説明とは別に、数字で）
function equipGameText(e) {
  if (!e || (e.cat !== "魂" && e.cat !== "レア魂") || !e.fx || e.fx.noBattle) return "";
  const t = fxDesc(e.fx);
  return t && !(e.desc ?? "").includes(t) ? t : ""; // このゲームの妖怪の魂は、説明がもともと効き方そのもの
}
// 持ち物 1 つの説明（詳しい画面・選ぶ画面・出陣前の確認で同じもの）
function equipInfoHtml(e) {
  if (!e) return "";
  const game = equipGameText(e);
  return `${equipDesc(e)}${game ? `<small class="pk-game">このゲームでは：${game}</small>` : ""}${e.recipe ? `<small class="pk-recipe">本家の合成：${e.recipe}</small>` : ""}`;
}

function openEquipPicker(d, cur, onPick) {
  const slotMember = { unit: d.id };
  const base = memberStats(slotMember);
  const deltas = new Map();
  const deltaOf = e => {
    if (!deltas.has(e.id)) {
      const st = memberStats({ ...slotMember, equipment: e.id });
      deltas.set(e.id, Object.fromEntries(STAT_ROWS.map(([k]) => [k, st[k] - base[k]])));
    }
    return deltas.get(e.id);
  };
  const statSort = k => e => deltaOf(e)[k] ?? 0;
  const items = [...equipChoices(d), ...soulChoices()];
  const now = equipById(cur ?? null);
  const off = q("button", "b-mini", "持ち物をはずす");
  off.disabled = !now;
  off.onclick = () => { onPick(null); p.close(); };
  const p = openSortPicker({
    key: "equip", title: `${d.name} の持ち物`, items, tabs: EQUIP_TABS, actions: [off],
    current: () => `<span class="dt-k">いま</span> ${now ? `<b>${now.name}</b><span class="pk-cat">${now.cat}</span><div class="pk-cur-d">${equipInfoHtml(now)}</div>` : "<b>なし</b>"}`,
    hide: { label: "対戦で効果のないものをかくす", test: equipNoEffect },
    sorts: [
      ["order", "本家の順", () => null],
      ...STAT_ROWS.map(([k, , label]) => [k, label + "が上がる", statSort(k)]),
      ["sum", "能力の合計", e => Object.values(deltaOf(e)).reduce((a, b) => a + b, 0)],
      ["name", "名前", e => e.name, !0],
    ],
    search: e => e.name + equipDesc(e) + equipGameText(e) + (e.recipe ?? ""),
    card: (e, sort) => {
      const on = e.id === (cur ?? null), none = equipNoEffect(e);
      const sp = equipDesc({ ...e, mods: {} }), game = equipGameText(e);
      const chips = deltaChips(deltaOf(e), STAT_ROWS.some(r => r[0] === sort) ? sort : null);
      return {
        cls: "pk-card pk-eq" + (on ? " cur" : "") + (none ? " none" : ""),
        title: [sp, game && "このゲームでは：" + game, e.recipe && "本家の合成：" + e.recipe].filter(Boolean).join("\n"),
        html: `<span class="pk-main"><span class="pk-name"><b>${e.name}</b>${on ? '<em class="pk-now">いま</em>' : ""}<span class="pk-cat">${e.cat}</span></span>
          ${chips ? `<span class="pk-ds">${chips}</span>` : ""}${sp ? `<small class="pk-sp">${sp}</small>` : ""}${game ? `<small class="pk-game">このゲームでは：${game}</small>` : ""}${e.recipe ? `<small class="pk-recipe">合成：${e.recipe}</small>` : ""}</span>`,
      };
    },
    onPick: e => { onPick(e.id); return !1; },
  });
}

// アイテム（対戦で使うたべもの・どうぐ）
function itemIcon(it) {
  return { heal: "食", soul: "飲", talisman: "札", revive: "薬", flee: "逃" }[it.kind];
}

function itemPower(it) {
  switch (it.kind) {
    case "heal": return ["HP", it.amount];
    case "soul": return ["妖気", it.amount];
    case "talisman": return [STAT_JA[it.stat], it.amount / 10 + "%"];
    case "revive": return ["復活", it.amount / 10 + "%"];
  }
  return ["", ""];
}

// 並べかえに使う効き目（回復量・妖気。チームの好物なら 1.25 倍で比べる）。おふだ・漢方は割合、どうぐは並べない
function itemAmount(it) {
  if (it.kind === "heal" || it.kind === "soul") return it.amount * (teamFans(it).length ? FAVORITE_MULT / 1000 : 1);
  if (it.kind === "talisman" || it.kind === "revive") return it.amount / 10;
  return null;
}

// いまの編成で、その食べ物が好物の妖怪
function teamFans(it) {
  if (!it.cat) return [];
  return [0, 1, 2, 3, 4, 5].map(i => bt[i] && ct.find(x => x.id === bt[i])).filter(d => d && favoriteOf(d) === it.cat).map(d => d.name);
}

var ITEM_TABS = [
  ["all", "すべて", () => !0],
  ["heal", "たべもの（HP）", it => it.kind === "heal"],
  ["soul", "牛乳・ジュース（妖気）", it => it.kind === "soul"],
  ["talisman", "おふだ", it => it.kind === "talisman"],
  ["revive", "漢方（復活）", it => it.kind === "revive"],
  ["flee", "どうぐ", it => it.kind === "flee"],
  ["fav", "チームの好物", it => teamFans(it).length > 0],
];
var ITEM_KIND_ORDER = ["heal", "soul", "talisman", "revive", "flee"];

function openItemPicker(onPick) {
  openSortPicker({
    key: "item", title: () => `アイテム（${BAG.length}/${BAG_SIZE}）　押すと入る`, items: BATTLE_ITEMS, tabs: ITEM_TABS,
    sorts: [
      ["order", "本家の順", () => null],
      // 種類ごとにまとめたうえで、その中を効き目の順に
      ["big", "効き目が大きい", it => itemAmount(it) == null ? null : itemAmount(it) - ITEM_KIND_ORDER.indexOf(it.kind) * 1e5],
      ["small", "効き目が小さい", it => itemAmount(it) == null ? null : itemAmount(it) + ITEM_KIND_ORDER.indexOf(it.kind) * 1e5, !0],
      ["kind", "種類", it => ITEM_KIND_ORDER.indexOf(it.kind), !0],
      ["name", "名前", it => it.name, !0],
    ],
    search: it => it.name + itemDesc(it) + (it.cat ? FOOD_CATS[it.cat] : ""),
    card: it => {
      const [unit, v] = itemPower(it), fans = teamFans(it), have = BAG.filter(x => x === it.id).length;
      return {
        cls: "pk-item" + (have ? " cur" : ""),
        html: `<span class="bag-ic ${it.kind}">${itemIcon(it)}</span><span class="pk-main"><b>${it.name}${have ? ` <em class="pk-have">×${have}</em>` : ""}</b>
          <small>${itemDesc(it)}</small>${fans.length ? `<small class="pk-fan">好物：${fans.join("・")}（1.25 倍）</small>` : ""}</span>
          ${v !== "" ? `<span class="pk-num"><small>${unit}</small>${v}</span>` : ""}`,
      };
    },
    onPick: it => { if (BAG.length >= BAG_SIZE) return !1; onPick(it.id); return BAG.length < BAG_SIZE; },
  });
}

// 出陣前の確認
function openConfirm(members, bag, onGo) {
  const wrap = q("div", "result confirm");
  const box = q("div", "box");
  box.append(q("div", "big", "出陣前の確認"));
  const grid = q("div", "cf-grid");
  members.forEach((m, i) => {
    const d = ct.find(x => x.id === m.unit), st = memberStats(m), tr = traitOf(d), eq = equipById(m.equipment ?? null);
    const card = q("div", "cf-card" + (i < 3 ? " front" : ""));
    card.innerHTML = `<div class="cf-head"><span class="cf-pic" style="background:${Pi[d.tribe]}">${da(d.id, d.name.slice(0, 1))}</span><div><b>${d.name}</b> <span class="rank ${d.rank}">${d.rank}</span><div class="tag">${i < 3 ? "前衛" : "後衛"}・${natureFullName(st.nature, st.diligence)}${st.favorite ? `・好物 ${FOOD_CATS[st.favorite]}` : ""}</div></div></div>
      <div class="cf-stats num">HP ${st.maxHp}　ちから ${st.atk}　ようりょく ${st.spa}　まもり ${st.def}　すばやさ ${st.spd}</div>
      <div class="cf-line"><span class="dt-k">特性</span> ${tr.name}</div>
      <div class="cf-line"><span class="dt-k">持ち物</span> ${eq ? `${eq.name}<small>（${equipDesc(eq)}）</small>` : "なし"}</div>`;
    grid.append(card);
  });
  box.append(grid);
  box.append(q("div", "cf-bag", `アイテム：${bag.length ? bag.map(id => battleItem(id).name).join("・") : "なし"}`));
  const row = q("div", "row");
  row.style.justifyContent = "center";
  const go = q("button", "btn primary", "この内容で対戦する");
  go.onclick = () => { wrap.remove(); onGo(); };
  const back = q("button", "btn", "編成にもどる");
  back.onclick = () => wrap.remove();
  row.append(back, go);
  box.append(row);
  wrap.append(box);
  document.body.append(wrap);
  go.focus();
}

// マイセットに保存した持ち物（古いセットには無いので null）
