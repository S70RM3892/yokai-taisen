// ============================================================================
// 編成画面の「確認」まわり：
//   ・選んだ妖怪の 3D モデル・能力値（装備こみ）・特性・好物などをその場で見る
//   ・性格／装備（魂もここ）／育成 をえらぶ
//   ・持ち物（対戦で使うアイテム）をえらぶ
//   ・「けってい」のあと、出陣前に 6 体と持ち物をまとめて確認する
// bt（ホイールの 6 枠の妖怪）と同じ並びで SLOT_LOADOUT（枠ごとの持ち物）を持つ。
// ============================================================================

function defaultLoadout() { return { nature: null, equipment: null, effort: null }; }
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

function effortPreset(id) { return Tu.find(x => x.id === id) ?? null; }
function memberAt(i) {
  if (!bt[i]) return null;
  const lo = SLOT_LOADOUT[i] ?? defaultLoadout();
  const d = ct.find(x => x.id === bt[i]);
  const m = { unit: bt[i] };
  if (lo.nature) m.nature = lo.nature;
  if (lo.equipment && equipAllowed(d, lo.equipment)) m.equipment = lo.equipment;
  if (lo.effort && effortPreset(lo.effort)) m.effort = { ...effortPreset(lo.effort).effort };
  return m;
}
function teamMembers() { return [0, 1, 2, 3, 4, 5].map(memberAt).filter(Boolean); }

// ---- ホイールの並びが変わったとき、持ち物もいっしょに動かす ----
function loRotate(step) { const old = SLOT_LOADOUT.slice(); SLOT_LOADOUT = old.map((_, i) => old[(i - step + 6) % 6]); saveLoadout(); }
function loSwap(a, b) { [SLOT_LOADOUT[a], SLOT_LOADOUT[b]] = [SLOT_LOADOUT[b], SLOT_LOADOUT[a]]; saveLoadout(); }
function loReset(i) { SLOT_LOADOUT[i] = defaultLoadout(); saveLoadout(); }
function loFromMembers(members) { SLOT_LOADOUT = members.map(m => ({ nature: m.nature ?? null, equipment: m.equipment ?? null, effort: m.effortPreset ?? null })); saveLoadout(); }

var STAT_ROWS = [["maxHp", "hp", "HP"], ["atk", "atk", "ちから"], ["spa", "spa", "ようりょく"], ["def", "def", "まもり"], ["spd", "spd", "すばやさ"]];

function statTable(d, st) {
  const max = { maxHp: 420, atk: 280, spa: 280, def: 280, spd: 260 };
  return `<div class="st-table">${STAT_ROWS.map(([k, b, label]) => {
    const base = d[b], v = st[k], diff = v - base;
    return `<span class="st-l">${label}</span><span class="st-bar"><i style="width:${Math.min(100, v * 100 / max[k])}%"></i>${diff ? `<b class="${diff > 0 ? "up" : "down"}" style="left:${Math.min(100, Math.min(v, base) * 100 / max[k])}%;width:${Math.abs(diff) * 100 / max[k]}%"></b>` : ""}</span><span class="st-v num">${v}${diff ? `<small class="${diff > 0 ? "up" : "down"}">${diff > 0 ? "+" : ""}${diff}</small>` : ""}</span>`;
  }).join("")}</div>`;
}

function optionList(sel, items, cur) {
  sel.replaceChildren();
  for (const it of items) {
    if (it.group) {
      const g = document.createElement("optgroup");
      g.label = it.group;
      for (const o of it.items) g.append(opt(o.value, o.label, cur));
      sel.append(g);
    } else sel.append(opt(it.value, it.label, cur));
  }
  function opt(v, l, c) { const o = document.createElement("option"); o.value = v ?? ""; o.textContent = l; o.selected = (v ?? "") === (c ?? ""); return o; }
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
  info.innerHTML = `<div class="dt-name"><b>${d.name}</b> <span class="rank ${d.rank}">${d.group ? d.rank + "・大物" : d.rank}</span></div>
    <div class="tag">${Hl[d.tribe]}族・${CAMP_JA[st.camp]}・好物「${FOOD_CATS[st.favorite]}」</div>
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

  // えらぶところ
  const form = q("div", "dt-form");
  const mk = (label, sel, note) => { const row = q("label", "dt-row"); row.append(q("span", "dt-k", label), sel); if (note) row.append(note); form.append(row); return row; };
  const selN = q("select", "dt-sel");
  optionList(selN, [{ value: "", label: `そのまま（${qn(d.defaultNature).name}）` }, ...$n.map(n => ({ value: n.id, label: n.name }))], lo.nature);
  selN.onchange = () => { SLOT_LOADOUT[slot].nature = selN.value || null; saveLoadout(); onChange(); };
  mk("性格", selN, q("span", "dt-note", natureDesc(lo.nature ?? d.defaultNature)));

  const selE = q("select", "dt-sel");
  const groups = new Map();
  for (const e of equipChoices(d)) { if (!groups.has(e.cat)) groups.set(e.cat, []); groups.get(e.cat).push({ value: e.id, label: e.name + (e.honke ? "" : "（このゲーム）") }); }
  const souls = soulChoices().map(s => ({ value: s.id, label: s.name }));
  optionList(selE, [{ value: "", label: "なし" }, ...[...groups].map(([g, items]) => ({ group: g === "このゲーム" ? "このゲームの装備" : `本家：${g}`, items })), { group: "魂（本家：魂へんげ）", items: souls }], lo.equipment);
  selE.onchange = () => { SLOT_LOADOUT[slot].equipment = selE.value || null; saveLoadout(); onChange(); };
  mk("持ち物", selE, q("span", "dt-note", eq ? equipDesc(eq) : "装備なし"));

  const selF = q("select", "dt-sel");
  optionList(selF, [{ value: "", label: "なし" }, ...Tu.map(t => ({ value: t.id, label: `${t.name}（${Object.entries(t.effort).filter(([, v]) => v).map(([k, v]) => `${STAT_JA[k]}+${k === "hp" ? v * wh : v}`).join("・")}）` }))], lo.effort);
  selF.onchange = () => { SLOT_LOADOUT[slot].effort = selF.value || null; saveLoadout(); onChange(); };
  mk("育成", selF, null);
  host.append(form);
}

function natureDesc(id) {
  const n = qn(id), names = ["こうげき", "ようじゅつ", "ガード", "とりつく(敵)", "とりつく(味方)"];
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

function itemIcon(it) {
  return { heal: "食", soul: "飲", talisman: "札", revive: "薬", flee: "逃" }[it.kind];
}

var ITEM_GROUPS = [
  ["heal", "たべもの（HP 回復）"], ["soul", "牛乳・ジュース（妖気）"], ["talisman", "おふだ（能力アップ）"], ["revive", "漢方（復活）"], ["flee", "どうぐ"],
];

function openItemPicker(onPick) {
  const wrap = q("div", "result picker");
  const box = q("div", "box");
  box.append(q("div", "title", "アイテム（本家のアイテム。CPU 戦で使う）"));
  const search = q("input", "b-search");
  search.placeholder = "名前でさがす";
  const body = q("div", "pick-body");
  const draw = () => {
    body.replaceChildren();
    for (const [kind, label] of ITEM_GROUPS) {
      const items = BATTLE_ITEMS.filter(x => x.kind === kind && (!search.value || x.name.includes(search.value)));
      if (!items.length) continue;
      body.append(q("div", "pick-h", label));
      const grid = q("div", "pick-grid");
      for (const it of items) {
        const b = q("button", "pick-item");
        b.innerHTML = `<span class="bag-ic ${it.kind}">${itemIcon(it)}</span><span><b>${it.name}</b><small>${itemDesc(it)}</small></span>`;
        b.onclick = () => { wrap.remove(); onPick(it.id); };
        grid.append(b);
      }
      body.append(grid);
    }
  };
  search.oninput = draw;
  const close = q("button", "btn", "とじる");
  close.onclick = () => wrap.remove();
  box.append(search, body, close);
  wrap.append(box);
  wrap.onclick = e => { if (e.target === wrap) wrap.remove(); };
  document.body.append(wrap);
  draw();
  search.focus();
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
    card.innerHTML = `<div class="cf-head"><span class="cf-pic" style="background:${Pi[d.tribe]}">${da(d.id, d.name.slice(0, 1))}</span><div><b>${d.name}</b> <span class="rank ${d.rank}">${d.rank}</span><div class="tag">${i < 3 ? "前衛" : "後衛"}・${qn(st.nature).name}・好物 ${FOOD_CATS[st.favorite]}</div></div></div>
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
function setLoadout(i) { const v = loadStored(`setlo:${i}`, null); return Array.isArray(v?.lo) && v.lo.length === 6 ? v.lo : null; }
function setBag(i) { const v = loadStored(`setlo:${i}`, null); return Array.isArray(v?.bag) ? v.bag : null; }
