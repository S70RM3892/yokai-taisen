// ============================================================================
// パーティの保存（アップデートしても編成がくずれないように）
//
// 保存する中身は「このゲームの内部 id」ではなく、本家で変わらないもの：
//   妖怪 … 本家の図鑑 No と名前（例 { no: 322, name: "ブシニャン" }）
//   性格 … 本家の性格 id（arakure など）とまじめさ
//   持ち物 … 装備の id と名前。魂は「どの妖怪の魂か」を妖怪と同じ形で
//   アイテム … id と名前
// 読むときは No → 名前 → 古い版の id の順にさがす。見つからないものだけを外し、何を外したかを知らせる
// （1 つが読めなくても、ほかの 5 体・持ち物は残す）。
//
// localStorage の "yokai-taisen:party" に { format, current, slots } を入れる。
//   current … いま編成画面で組んでいる 6 体（ページを開きなおしても続きから）
//   slots   … マイセット（PARTY_SLOTS 個。名前をつけられる）
// 書き出し：パーティを「YT1:」で始まる文字列にして、別の端末・別のブラウザへ持っていける。
// 前の版の保存（set:0〜2 / setlo:0〜2 / loadout / bag）は、はじめて開いたときに一度だけ読みこむ。
// ============================================================================

var PARTY_FORMAT = 1;
var PARTY_SLOTS = 8;
var PARTY_KEY = "party";
// 前の版の id（このゲーム独自の妖怪の id を使っていたころ）→ 本家の名前
var LEGACY_UNIT_ID = {
  g067: "化け草履", tengu: "天狗", kappa: "河童", rokurokubi: "ろくろ首", g075: "ブリー隊長", g102: "マスクドニャーン", g262: "ブシニャン",
  g066: "肉くいおとこ", g004: "オオクワノ神", oni: "赤鬼", g007: "さきがけの助", g189: "ミツマタノヅチ", g211: "ばか頭巾", p001: "ひとまか仙人",
  g213: "草くいおとこ", g104: "ガマンモス", ogama: "大ガマ", karakasa: "から傘お化け", g100: "黒鬼", g231: "ドケチング", g199: "しどろもどろ",
  g170: "びきゃく", g010: "万尾獅子", g109: "むりだ城", p002: "あせっか鬼", nurikabe: "シロカベ",
};

// ---- 妖怪・持ち物を、変わらない形にする／もどす ----
function unitRef(id) {
  const d = ct.find(x => x.id === id);
  return d ? { no: d.no, name: d.name } : { id };
}
function findUnit(ref) {
  if (!ref) return null;
  if (typeof ref === "string") ref = { id: ref };
  const byNo = ref.no != null ? ct.find(d => d.no === ref.no) : null;
  if (byNo && (!ref.name || byNo.name === ref.name)) return byNo;
  if (ref.name) { const byName = ct.find(d => d.name === ref.name); if (byName) return byName; }
  if (byNo) return byNo; // 名前だけ変わった（表記ゆれの直しなど）
  if (ref.id) {
    const d = ct.find(x => x.id === ref.id);
    if (d) return d;
    const legacy = LEGACY_UNIT_ID[ref.id];
    if (legacy) return ct.find(x => x.name === legacy) ?? null;
  }
  return null;
}
function refLabel(ref) {
  if (!ref) return "?";
  if (typeof ref === "string") return LEGACY_UNIT_ID[ref] ?? ref;
  return ref.name ?? LEGACY_UNIT_ID[ref.id] ?? ref.id ?? `No.${ref.no}`;
}
function equipRef(id) {
  if (!id) return null;
  if (id.startsWith(SOUL_PREFIX)) return { soul: unitRef(id.slice(SOUL_PREFIX.length)) };
  const e = equipById(id);
  return { id, name: e?.name ?? id };
}
function findEquip(ref) {
  if (!ref) return null;
  if (typeof ref === "string") ref = ref.startsWith(SOUL_PREFIX) ? { soul: { id: ref.slice(SOUL_PREFIX.length) } } : { id: ref };
  if (ref.soul) { const d = findUnit(ref.soul); return d && equipById(SOUL_PREFIX + d.id) ? SOUL_PREFIX + d.id : null; }
  if (ref.id && equipById(ref.id)) return ref.id;
  const byName = ref.name ? Ni.find(e => e.name === ref.name) : null;
  return byName?.id ?? null;
}
function equipLabel(ref) {
  if (!ref) return "?";
  if (typeof ref === "string") return ref;
  return ref.soul ? `${refLabel(ref.soul)}の魂` : ref.name ?? ref.id;
}
function itemRef(id) { const it = battleItem(id); return { id, name: it?.name ?? id }; }
function findItem(ref) {
  if (!ref) return null;
  if (typeof ref === "string") ref = { id: ref };
  if (battleItem(ref.id)) return ref.id;
  return BATTLE_ITEMS.find(x => x.name === ref.name)?.id ?? null;
}

// ---- いまの編成 → パーティ ----
function partyFromBuilder(name = "") {
  return {
    name, savedAt: Date.now(), app: String(NET_VER),
    members: [0, 1, 2, 3, 4, 5].map(i => {
      if (!bt[i]) return null;
      const lo = SLOT_LOADOUT[i] ?? defaultLoadout();
      return { unit: unitRef(bt[i]), nature: lo.nature ?? null, diligence: lo.diligence ?? null, equip: equipRef(lo.equipment) };
    }),
    bag: BAG.map(itemRef),
  };
}

// パーティ → 編成（bt・SLOT_LOADOUT・BAG）。読めなかったものは lost に入れて返す
function partyResolve(party) {
  const lost = [], team = [], lo = [];
  const ms = Array.isArray(party?.members) ? party.members.slice(0, 6) : [];
  while (ms.length < 6) ms.push(null);
  for (const m of ms) {
    const d = m ? findUnit(m.unit) : null;
    if (m && !d) lost.push(`妖怪「${refLabel(m.unit)}」`);
    team.push(d ? d.id : null);
    const l = defaultLoadout();
    if (d) {
      try { if (m.nature) l.nature = natureId(m.nature); } catch { lost.push(`${d.name}の性格`); }
      if (m.diligence) l.diligence = DILIGENCE.some(x => x.id === m.diligence) ? m.diligence : null;
      if (m.equip) {
        const eq = findEquip(m.equip);
        if (eq && equipAllowed(d, eq)) l.equipment = eq; else lost.push(`${d.name}の持ち物「${equipLabel(m.equip)}」`);
      }
    }
    lo.push(l);
  }
  const bag = [];
  for (const r of Array.isArray(party?.bag) ? party.bag : []) {
    const id = findItem(r);
    id ? bag.push(id) : lost.push(`アイテム「${typeof r === "string" ? r : r?.name ?? r?.id}」`);
  }
  return { team, lo, bag: bag.slice(0, BAG_SIZE), lost };
}

function partyApply(party) {
  const r = partyResolve(party);
  bt = r.team;
  SLOT_LOADOUT = r.lo;
  BAG = r.bag;
  saveLoadout();
  return r.lost;
}

// ---- 保存場所 ----
function partyStore() {
  let s = loadStored(PARTY_KEY, null);
  if (!s || typeof s !== "object" || !Array.isArray(s.slots)) s = partyMigrate();
  while (s.slots.length < PARTY_SLOTS) s.slots.push(null);
  return s;
}
function partyStoreSave(s) {
  s.format = PARTY_FORMAT;
  saveStored(PARTY_KEY, s);
}
// 前の版の保存を一度だけ読む（前の版の保存そのものは消さない）
function partyMigrate() {
  const s = { format: PARTY_FORMAT, current: null, slots: [] };
  for (let i = 0; i < 3; i++) {
    const team = loadStored(`set:${i}`, null), extra = loadStored(`setlo:${i}`, null);
    if (!Array.isArray(team)) { s.slots.push(null); continue; }
    const lo = Array.isArray(extra?.lo) ? extra.lo : [];
    s.slots.push({
      name: `セット ${i + 1}`, savedAt: 0, app: "",
      members: team.slice(0, 6).map((id, k) => id ? { unit: { id }, nature: lo[k]?.nature ?? null, diligence: lo[k]?.diligence ?? null,
        equip: lo[k]?.equipment ? (lo[k].equipment.startsWith(SOUL_PREFIX) ? { soul: { id: lo[k].equipment.slice(SOUL_PREFIX.length) } } : { id: lo[k].equipment }) : null } : null),
      bag: Array.isArray(extra?.bag) ? extra.bag.map(id => ({ id })) : [],
    });
  }
  partyStoreSave(s);
  return s;
}

// いま組んでいる編成を保存する（編成画面を描きなおすたび）
function partySaveCurrent() {
  const s = partyStore();
  s.current = partyFromBuilder();
  partyStoreSave(s);
}
// ページを開いたとき：前回の続きをもどす。もどせたら true
function partyRestoreCurrent() {
  const s = partyStore();
  if (!s.current || !s.current.members?.some(Boolean)) return { ok: false, lost: [] };
  const lost = partyApply(s.current);
  return { ok: bt.some(Boolean), lost };
}

// ---- 書き出し・読みこみ（文字列） ----
function partyEncode(party) {
  const json = JSON.stringify({ f: PARTY_FORMAT, n: party.name, m: party.members.map(m => m && [m.unit.no ?? m.unit.id, m.unit.name, m.nature, m.diligence, m.equip]), b: party.bag.map(b => b.id) });
  return "YT1:" + btoa(String.fromCharCode(...new TextEncoder().encode(json)));
}
function partyDecode(code) {
  const t = String(code ?? "").trim().replace(/\s+/g, "");
  if (!t.startsWith("YT1:")) throw new Error("「YT1:」で始まる文字列を貼ってください");
  let o;
  try { o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(t.slice(4)), c => c.charCodeAt(0)))); } catch { throw new Error("文字列がこわれています（最後まで貼れているか確かめてください）"); }
  if (!Array.isArray(o?.m)) throw new Error("パーティが入っていません");
  return {
    name: o.n ?? "", savedAt: Date.now(), app: "",
    members: o.m.slice(0, 6).map(x => x && { unit: typeof x[0] === "number" ? { no: x[0], name: x[1] } : { id: x[0], name: x[1] }, nature: x[2], diligence: x[3], equip: x[4] }),
    bag: (o.b ?? []).map(id => ({ id })),
  };
}

// ---- 編成画面の「マイセット」 ----
function partyBox(onChange) {
  const box = q("div", "b-sets");
  const note = q("div", "ps-note");
  const render = () => {
    const s = partyStore();
    box.replaceChildren(q("div", "b-rules-t", "マイセット"));
    const full = bt.filter(Boolean).length === 6;
    s.slots.forEach((p, i) => {
      const row = q("div", "b-set ps-row");
      const r = p ? partyResolve(p) : null;
      const faces = p ? r.team.map((id, k) => id ? da(id, ct.find(x => x.id === id).name.slice(0, 1)) : `<span class="ps-miss" title="${refLabel(p.members[k]?.unit)}">？</span>`).join("") : "";
      const load = q("button", "b-mini ps-load");
      load.innerHTML = p ? `<b>${p.name || `セット ${i + 1}`}</b><span class="ps-faces">${faces}</span>${r.lost.length ? `<small class="ps-warn">${r.lost.length} つ読めない</small>` : ""}` : `<span class="ps-empty">${i + 1}：空き</span>`;
      load.disabled = !p;
      load.title = p ? `${p.members.map((m, k) => m ? `${k < 3 ? "前" : "後"} ${refLabel(m.unit)}${m.equip ? `（${equipLabel(m.equip)}）` : ""}` : "").filter(Boolean).join("\n")}${p.savedAt ? `\n保存：${new Date(p.savedAt).toLocaleString()}` : ""}` : "";
      load.onclick = () => {
        const lost = partyApply(p);
        note.textContent = lost.length ? `読めなかったので外した：${lost.join("・")}` : `「${p.name || `セット ${i + 1}`}」を入れた`;
        note.classList.toggle("bad", lost.length > 0);
        onChange();
      };
      const save = q("button", "b-mini save", "保存");
      save.disabled = !full;
      save.title = full ? "いまの 6 体・性格・持ち物・アイテムをこのセットに保存" : "6 体そろうと保存できる";
      save.onclick = () => {
        const cur = partyStore();
        const nm = cur.slots[i]?.name || `セット ${i + 1}`;
        cur.slots[i] = partyFromBuilder(nm);
        partyStoreSave(cur);
        note.textContent = `「${nm}」に保存した`, note.classList.remove("bad");
        render();
      };
      const more = q("button", "b-mini ps-more", "…");
      more.title = "名前・書き出し・消す";
      more.onclick = () => partyMenu(i, render, note, onChange);
      row.append(load, save, more);
      box.append(row);
    });
    const io = q("div", "ps-io");
    const imp = q("button", "b-mini", "文字列から読みこむ");
    imp.onclick = () => {
      const code = prompt("書き出した文字列（YT1:…）を貼ってください");
      if (!code) return;
      try {
        const p = partyDecode(code);
        const lost = partyApply(p);
        note.textContent = lost.length ? `読みこんだ（外したもの：${lost.join("・")}）` : "読みこんだ";
        note.classList.toggle("bad", lost.length > 0);
        onChange();
      } catch (e) { note.textContent = e.message, note.classList.add("bad"); render(); }
    };
    const exp = q("button", "b-mini", "いまの編成を書き出す");
    exp.disabled = !bt.some(Boolean);
    exp.onclick = () => partyExport(partyFromBuilder("いまの編成"), note);
    io.append(exp, imp);
    box.append(io, note);
  };
  render();
  box.refresh = render;
  return box;
}

function partyExport(p, note) {
  const code = partyEncode(p);
  const done = ok => { note.textContent = ok ? "書き出した文字列をコピーした（別の端末で「文字列から読みこむ」に貼る）" : "コピーできなかったので、出てきた文字列を手でコピーしてください"; note.classList.remove("bad"); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(code).then(() => done(true), () => { prompt("この文字列をコピーしてください", code); done(false); });
  else { prompt("この文字列をコピーしてください", code); done(false); }
}

function partyMenu(i, render, note, onChange) {
  const s = partyStore(), p = s.slots[i];
  const act = prompt(`セット ${i + 1}：番号を入れてください\n1 名前をつける\n2 書き出す（文字列）\n3 消す`, "1");
  if (act === "1") {
    if (!p) { note.textContent = "空きのセットには名前をつけられない（先に保存）"; return; }
    const nm = prompt("セットの名前", p.name || `セット ${i + 1}`);
    if (nm !== null) { p.name = nm.slice(0, 20); partyStoreSave(s); }
  } else if (act === "2") {
    if (p) partyExport(p, note);
  } else if (act === "3") {
    if (p && confirm(`「${p.name || `セット ${i + 1}`}」を消しますか？`)) { s.slots[i] = null; partyStoreSave(s); note.textContent = "消した"; }
  }
  render();
}
