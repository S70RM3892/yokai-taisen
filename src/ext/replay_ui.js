// ============================================================================
// リプレイ（画面側）：保存・一覧・再生（一時停止・倍速・好きな場面へ）・振り返り・書き出し／読みこみ。
//   保存：一覧（replays）と中身（replay:<id>。YR1: の文字列）を分けて localStorage へ。
//   自動で残すのは最近の 20 戦。「残す」を押したものは消えない（30 戦まで）。
//   振り返り：対戦をエンジンだけでもう一度流して、妖怪ごとの数字・HP の移り変わり・大きな出来事を出す。
// ============================================================================
var REPLAY_AUTO_MAX = 20, REPLAY_KEPT_MAX = 30;
var REPLAY_CACHE = new Map(); // id → リプレイ（読みこみ直さない）

function replayIndex() {
  const v = loadStored("replays", []);
  return Array.isArray(v) ? v.filter(x => x && typeof x.id === "string") : [];
}
function replayIndexSave(list) { saveStored("replays", list); }
function replayStoreSet(key, value) {
  try { localStorage.setItem("yokai-taisen:" + key, value); return !0; } catch { return !1; }
}
function replayForget(id) {
  try { localStorage.removeItem("yokai-taisen:replay:" + id); } catch {}
  REPLAY_CACHE.delete(id);
}

// 自分の側から見た勝ち負け（1 勝ち・-1 負け・0 引き分け）
function replayWinOf(rep) {
  const w = rep.outcome?.winner, me = rep.meta?.me ?? 0;
  return w === null || w === void 0 ? 0 : w === me ? 1 : -1;
}

function replayEntry(rep, id, kept) {
  const me = rep.meta?.me ?? 0;
  return {
    id, kept: !!kept, at: rep.meta?.at ?? Date.now(), ver: rep.ver, mode: rep.meta?.mode ?? "cpu",
    diff: rep.meta?.diff, peer: rep.meta?.peer, me, win: replayWinOf(rep), reason: rep.outcome?.reason ?? null, end: rep.end,
    mine: rep.teams[me].map(m => m.unit), foe: rep.teams[1 - me].map(m => m.unit), imported: !!rep.meta?.imported,
  };
}

// 保存（古い自動のものから押し出す。入りきらないときは、さらに古いものを消してやり直す）
async function replaySave(rep, kept = !1) {
  const code = await replayExport(rep);
  const id = (rep.meta?.at ?? Date.now()).toString(36) + Math.floor(Math.random() * 1296).toString(36);
  REPLAY_CACHE.set(id, rep);
  let list = [replayEntry(rep, id, kept), ...replayIndex()];
  const prune = () => {
    const auto = list.filter(x => !x.kept), keep = list.filter(x => x.kept);
    const drop = [...auto.slice(REPLAY_AUTO_MAX), ...keep.slice(REPLAY_KEPT_MAX)];
    for (const x of drop) replayForget(x.id);
    list = list.filter(x => !drop.includes(x));
  };
  prune();
  while (!replayStoreSet("replay:" + id, code)) {
    const old = list.filter(x => !x.kept && x.id !== id).pop();
    if (!old) { replayIndexSave(list.filter(x => x.id !== id)); throw new Error("保存する場所が足りない"); }
    replayForget(old.id), list = list.filter(x => x !== old);
  }
  replayIndexSave(list);
  return id;
}

async function replayLoad(id) {
  if (REPLAY_CACHE.has(id)) return REPLAY_CACHE.get(id);
  let code = null;
  try { code = localStorage.getItem("yokai-taisen:replay:" + id); } catch {}
  if (!code) throw new Error("リプレイが見つからない");
  const rep = await replayImport(code);
  REPLAY_CACHE.set(id, rep);
  return rep;
}

function replaySetKept(id, kept) {
  const list = replayIndex();
  const x = list.find(y => y.id === id);
  if (!x) return !1;
  if (kept && list.filter(y => y.kept).length >= REPLAY_KEPT_MAX) return !1;
  x.kept = kept, replayIndexSave(list);
  return !0;
}

function replayDelete(id) {
  replayForget(id), replayIndexSave(replayIndex().filter(x => x.id !== id));
}

// ---- 見出し・一覧の 1 行 ----
function replayModeLabel(x) {
  if (x.imported) return "読みこんだ対戦";
  return x.mode === "pvp" ? `対人戦 vs ${x.peer ?? "相手"}` : `CPU（${or[x.diff]?.name ?? "?"}）`;
}
function replayTitle(rep) {
  return `リプレイ・${replayModeLabel(replayEntry(rep, "", !1))}`;
}
function fmtTick(t) {
  const s = Math.max(0, Math.floor(t / 20));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtWhen(at) {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function faceStrip(ids) {
  return `<span class="rp-faces">${ids.map(id => { const d = ct.find(x => x.id === id); return d ? `<span class="rp-face" style="background:${Pi[d.tribe]}" title="${d.name}">${da(d.id, "")}</span>` : '<span class="rp-face">？</span>'; }).join("")}</span>`;
}
var REASON_JA = { ko: "全滅", time: "時間切れ", flee: "逃げた" };

function replayRow(x, refresh, compact = !1) {
  const row = q("div", "rp-row" + (x.kept ? " kept" : ""));
  const ok = x.ver === APP_VERSION;
  const res = x.win > 0 ? ["win", "勝ち"] : x.win < 0 ? ["lose", "負け"] : ["draw", "引き分け"];
  const info = q("div", "rp-info");
  info.innerHTML = `<div class="rp-l1"><span class="rp-res ${res[0]}">${res[1]}</span><b>${replayModeLabel(x)}</b><span class="muted small">${fmtWhen(x.at)}・${fmtTick(x.end)}${x.reason ? `・${REASON_JA[x.reason] ?? ""}` : ""}</span>${x.kept ? '<span class="rp-kept">残す</span>' : ""}</div>
    <div class="rp-l2">${faceStrip(x.mine)}<span class="rp-vs">vs</span>${faceStrip(x.foe)}</div>${ok ? "" : `<div class="rp-old">版 ${x.ver} の対戦なので、いまの版では再生できない</div>`}`;
  const btns = q("div", "rp-btns");
  const play = q("button", "btn small primary rp-play", "▶ 再生");
  const review = q("button", "btn small rp-review", "振り返り");
  play.disabled = review.disabled = !ok;
  play.onclick = async () => { try { playReplay(await replayLoad(x.id), 0, { id: x.id }); } catch (err) { replayToast(String(err.message ?? err)); } };
  review.onclick = async () => { try { openReview(await replayLoad(x.id), { id: x.id }); } catch (err) { replayToast(String(err.message ?? err)); } };
  btns.append(play, review);
  if (!compact) {
    const keep = q("button", "btn small rp-keep" + (x.kept ? " on" : ""), x.kept ? "★ 残す" : "☆ 残す");
    keep.title = x.kept ? "自動で消えないようにしている（押すと外す）" : `自動では最近の ${REPLAY_AUTO_MAX} 戦だけ残る。押すと消えない（${REPLAY_KEPT_MAX} 戦まで）`;
    keep.onclick = () => { if (!replaySetKept(x.id, !x.kept)) replayToast(`残せるのは ${REPLAY_KEPT_MAX} 戦まで`); refresh(); };
    const out = q("button", "btn small rp-export", "書き出し");
    out.onclick = async () => { try { replayShowCode(await replayExport(await replayLoad(x.id))); } catch (err) { replayToast(String(err.message ?? err)); } };
    const del = q("button", "btn small rp-del", "消す");
    del.onclick = () => { if (del.dataset.arm) { replayDelete(x.id); refresh(); } else { del.dataset.arm = "1", del.textContent = "本当に消す"; setTimeout(() => { delete del.dataset.arm; del.textContent = "消す"; }, 2500); } };
    btns.append(keep, out, del);
  }
  row.append(info, btns);
  return row;
}

function replayToast(text) {
  document.querySelector(".rp-toast")?.remove();
  const t = q("div", "rp-toast", text);
  t.setAttribute("role", "status");
  document.body.append(t);
  setTimeout(() => t.remove(), 2600);
}

function replayShowCode(code) {
  const wrap = q("div", "result"), box = q("div", "box rp-code");
  const ta = q("textarea", "rp-ta");
  ta.readOnly = !0, ta.value = code;
  const row = q("div", "row");
  row.style.justifyContent = "center";
  const copy = q("button", "btn primary", "コピー");
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(code); copy.textContent = "コピーした"; } catch { ta.select(); document.execCommand?.("copy"); copy.textContent = "選んだ（コピーして）"; }
  };
  const close = q("button", "btn", "とじる");
  close.onclick = () => wrap.remove();
  row.append(close, copy);
  box.append(q("div", "title", "リプレイの書き出し"), q("div", "muted small", `この文字列を相手に送ると、「リプレイ」の「読みこむ」で同じ対戦を見られる（同じ版 ${APP_VERSION} どうし）。${code.length.toLocaleString()} 文字`), ta, row);
  wrap.append(box);
  wrap.onclick = e => { e.target === wrap && wrap.remove(); };
  document.body.append(wrap);
  ta.focus(), ta.select();
}

// ---- ホームの「リプレイ」 ----
function renderReplayHome(main) {
  const list = replayIndex();
  const top = q("div", "hm-card");
  const hd = q("div", "hm-head");
  hd.append(q("span", "hm-t", "リプレイ"), q("span", "hm-sub", `最近の ${REPLAY_AUTO_MAX} 戦は自動で残る。★ で消えないようにできる（${list.filter(x => x.kept).length}/${REPLAY_KEPT_MAX}）`));
  top.append(hd);
  const imp = q("div", "rp-import");
  const ta = q("textarea", "rp-ta small");
  ta.placeholder = "YR1: で始まるリプレイの文字列を貼る";
  ta.rows = 2;
  const go = q("button", "btn small", "読みこむ");
  const note = q("div", "ps-note");
  go.onclick = async () => {
    try {
      const rep = await replayImport(ta.value);
      const bad = replayProblem(rep);
      if (bad) throw new Error(bad);
      rep.meta = { ...rep.meta, imported: !0 };
      await replaySave(rep, !0);
      showHome("replay");
    } catch (err) { note.textContent = `読みこめない：${err.message ?? err}`, note.classList.add("bad"); }
  };
  imp.append(ta, go);
  top.append(imp, note);
  main.append(top);
  const box = q("div", "hm-card rp-list");
  if (!list.length) box.append(q("div", "muted", "まだ対戦がない。対戦が終わると、ここに残る。"));
  for (const x of list) box.append(replayRow(x, () => showHome("replay")));
  main.append(box);
}

// ---- 結果画面に足す行（振り返り・リプレイ・残す） ----
function replayResultRow(rep, wrap) {
  const row = q("div", "row rp-result");
  row.style.justifyContent = "center";
  let id = null;
  const saved = replaySave(rep).then(v => (id = v)).catch(() => null);
  const review = q("button", "btn rs-review", "振り返り");
  review.onclick = () => openReview(rep, { fromResult: wrap, id });
  const play = q("button", "btn rs-replay", "リプレイを見る");
  play.onclick = () => { wrap.remove(); playReplay(rep, 0, { id }); };
  const keep = q("button", "btn rs-keep", "☆ リプレイを残す");
  keep.onclick = async () => {
    await saved;
    if (id && replaySetKept(id, !0)) keep.textContent = "★ 残した", keep.disabled = !0;
    else replayToast(id ? `残せるのは ${REPLAY_KEPT_MAX} 戦まで` : "保存できなかった");
  };
  row.append(review, play, keep);
  return row;
}

// ---- 再生 ----
function playReplay(rep, fromTick = 0, opt = {}) {
  const bad = replayProblem(rep);
  if (bad) return replayToast(bad);
  document.querySelectorAll(".result").forEach(x => x.remove());
  SCREEN_LEAVE?.(), SCREEN_LEAVE = null;
  if (Ga) Ga.running = !1;
  Kr.replaceChildren();
  const canvas = q("canvas", "stage"), scene = new e2(canvas);
  const inputs = replayInputs(rep), me = rep.meta?.me === 1 ? 1 : 0;
  const canon = replayState(rep, fromTick, inputs);
  const sp = loadStored("replay:speed", 1);
  Ga = {
    state: me ? mirrorState(canon) : canon,
    canon,
    replay: { rep, inputs, me, id: opt.id ?? null, speed: [1, 2, 4].includes(sp) ? sp : 1, paused: !1, done: replayEnded },
    net: null, cpu: null, diff: rep.meta?.diff ?? Ri, stats: I2(), partners: [[], []],
    introUntil: fromTick ? 0 : performance.now() + 1200, introStep: -1,
    pending: [], zero: !1, mode: "none", running: !0, preview: 0, previewTimer: null,
    lastFrame: performance.now(), acc: 0, scene, refs: {}, svg: {}, plates: [], foeBars: new Map,
    logEl: q("div", "log"), called: "", wheelKey: "", epoch: 0,
  };
  O2(Ga, canvas);
  Kr.querySelector(".game")?.classList.add("replaying");
  replayBar(Ga);
  const foe = Ga.state.players[1].units.map(u => ct[u.defIndex].name).join("・");
  Rt(Ga, `リプレイ：${replayModeLabel(replayEntry(rep, "", !1))}（相手：${foe}）`, "f");
  const esc = e => {
    if (!Ga?.replay || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const r = Ga.replay;
    if (e.key === " ") e.preventDefault(), replayTogglePause(Ga);
    else if (e.key === "ArrowRight") replaySeek(Ga, Ga.canon.tick + 100);
    else if (e.key === "ArrowLeft") replaySeek(Ga, Ga.canon.tick - 100);
    else if (e.key === "Escape" && !document.querySelector(".result")) showHome("replay");
    r.bar?.sync();
  };
  document.addEventListener("keydown", esc);
  SCREEN_LEAVE = () => { document.removeEventListener("keydown", esc); if (Ga?.replay) Ga.running = !1, Ga = null, zl(); };
  xd(), requestAnimationFrame(Ud);
}

// Ud から毎フレーム：速さに合わせて tick を進める
function replayPump(t) {
  const r = t.replay;
  if (r.paused) { t.acc = 0; r.bar?.sync(); return; }
  const need = 50 / r.speed;
  let n = 0;
  while (t.acc >= need && n < 5 * r.speed && !t.canon.outcome) {
    const ev = [];
    replayStep(t.canon, r.inputs, ev);
    if (r.me) t.state = mirrorState(t.canon), playEvents(t, ev.map(mirrorEvent));
    else t.state = t.canon, playEvents(t, ev);
    t.acc -= need, n++;
  }
  r.bar?.sync();
}

function replayTogglePause(t) {
  t.replay.paused = !t.replay.paused;
  if (!t.replay.paused && !t.running && !t.canon.outcome) t.running = !0, t.lastFrame = performance.now(), requestAnimationFrame(Ud);
}

// 好きな tick へ（エンジンだけで最初から進め直す。見えている HP・演出は捨てる）
function replaySeek(t, tick) {
  const r = t.replay;
  tick = Math.max(0, Math.min(r.rep.end, Math.round(tick)));
  t.epoch = (t.epoch ?? 0) + 1;
  t.canon = replayState(r.rep, tick, r.inputs);
  t.state = r.me ? mirrorState(t.canon) : t.canon;
  t.view = new Map(), t.partners = [[], []], t.introUntil = 0, t.acc = 0;
  t.refs.fx?.replaceChildren();
  t.refs.top?.querySelectorAll(".cutin, .banner, .combo").forEach(x => x.remove());
  t.refs.top?.classList.toggle("sudden-on", t.canon.tick >= fr);
  We.fast = t.canon.tick >= fr;
  document.querySelector(".rp-end")?.remove();
  Rt(t, `── ${fmtTick(tick)} へ飛んだ ──`, "");
  if (!t.running) t.running = !0, t.lastFrame = performance.now(), requestAnimationFrame(Ud);
  r.bar?.sync();
}

function replayBar(t) {
  const r = t.replay, end = r.rep.end;
  const bar = q("div", "rp-bar");
  const pause = q("button", "btn small rp-pause");
  const speeds = q("div", "b-diff rp-speed");
  for (const v of [1, 2, 4]) {
    const b = q("button", "", `×${v}`);
    b.dataset.v = String(v);
    b.onclick = () => { r.speed = v, saveStored("replay:speed", v), sync(); };
    speeds.append(b);
  }
  const range = q("input", "rp-range");
  range.type = "range", range.min = "0", range.max = String(end), range.step = "20";
  range.setAttribute("aria-label", "再生の位置");
  let dragging = !1;
  range.oninput = () => { dragging = !0, time.textContent = `${fmtTick(Number(range.value))} / ${fmtTick(end)}`; };
  range.onchange = () => { dragging = !1, replaySeek(t, Number(range.value)); };
  const time = q("span", "rp-time num");
  const back10 = q("button", "btn small", "−5秒");
  back10.onclick = () => replaySeek(t, t.canon.tick - 100);
  const fwd10 = q("button", "btn small", "+5秒");
  fwd10.onclick = () => replaySeek(t, t.canon.tick + 100);
  const review = q("button", "btn small rp-rv", "振り返り");
  review.onclick = () => { r.paused = !0, sync(), openReview(r.rep, { player: t, id: r.id }); };
  const home = q("button", "btn small", "ホームへ");
  home.onclick = () => showHome("replay");
  pause.onclick = () => { replayTogglePause(t), sync(); };
  bar.append(pause, back10, fwd10, speeds, range, time, review, home);
  let last = "";
  const sync = () => {
    const k = `${r.paused}|${r.speed}|${t.canon.tick}`;
    if (k === last) return;
    last = k;
    pause.textContent = r.paused ? "▶ 再生" : "❚❚ 止める";
    speeds.querySelectorAll("button").forEach(b => b.classList.toggle("on", Number(b.dataset.v) === r.speed));
    if (!dragging) range.value = String(t.canon.tick), time.textContent = `${fmtTick(t.canon.tick)} / ${fmtTick(end)}`;
  };
  r.bar = { sync };
  Kr.querySelector(".layout3d")?.before(bar);
  sync();
}

// 最後まで見た
function replayEnded(t) {
  document.querySelector(".rp-end")?.remove();
  const a = q("div", "result rp-end"), box = q("div", "box");
  const w = replayWinOf(t.replay.rep);
  box.append(q("div", "big" + (w < 0 ? " lose" : w > 0 ? "" : " draw"), w > 0 ? "勝ち" : w < 0 ? "負け" : "引き分け"), q("div", "muted", `リプレイおわり・${fmtTick(t.replay.rep.end)}`));
  const row = q("div", "row");
  row.style.justifyContent = "center";
  const again = q("button", "btn primary", "最初から");
  again.onclick = () => { a.remove(), replaySeek(t, 0); };
  const review = q("button", "btn", "振り返り");
  review.onclick = () => { a.remove(), openReview(t.replay.rep, { player: t, id: t.replay.id }); };
  const home = q("button", "btn", "ホームへ");
  home.onclick = () => { a.remove(), showHome("replay"); };
  row.append(again, review, home);
  box.append(row), a.append(box), document.body.append(a);
}

// ---- 振り返り ----
function reviewJump(rep, opt, tick) {
  document.querySelectorAll(".rv-wrap, .rp-end").forEach(x => x.remove());
  const t = opt.player;
  if (t && Ga === t) { replaySeek(t, tick), t.replay.paused = !1, t.replay.bar?.sync(); return; }
  opt.fromResult?.remove();
  playReplay(rep, tick, { id: opt.id });
}

function openReview(rep, opt = {}) {
  const bad = replayProblem(rep);
  if (bad) return replayToast(bad);
  document.querySelector(".rv-wrap")?.remove();
  const rv = replayReview(rep);
  const me = rep.meta?.me === 1 ? 1 : 0, foe = 1 - me;
  const side = uid => (uid < ii ? 0 : 1) === me ? "a" : "f";
  const nameOf = uid => rv.units[uid] ? `${side(uid) === "a" ? "" : "相手の"}${rv.units[uid].name}` : "?";
  const wrap = q("div", "result rv-wrap"), box = q("div", "box rv-box");
  const w = replayWinOf(rep);
  const head = q("div", "rv-head");
  head.innerHTML = `<span class="big${w < 0 ? " lose" : w > 0 ? "" : " draw"}">${w > 0 ? "勝ち" : w < 0 ? "負け" : "引き分け"}</span><div><b>振り返り</b><div class="muted small">${replayModeLabel(replayEntry(rep, "", !1))}・${fmtTick(rv.end)}・${REASON_JA[rv.outcome?.reason] ?? ""}</div></div>`;
  const x = q("button", "pk-x", "×");
  x.setAttribute("aria-label", "とじる");
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { e.key === "Escape" && close(); };
  x.onclick = close;
  head.append(x);
  box.append(head);

  // HP の移り変わり（押すと、その少し前から再生）
  const W = 640, H = 170, P = 8, xs = t => P + (W - 2 * P) * t / Math.max(1, rv.end), ys = v => P + (H - 2 * P) * (1 - v / 1000);
  const line = k => rv.hp.map(([t, ...v]) => `${xs(t).toFixed(1)},${ys(v[k]).toFixed(1)}`).join(" ");
  const marks = rv.moments.filter(m => m.kind === "ko" || m.kind === "ult").map(m => {
    const uid = m.kind === "ko" ? m.dst : m.src, s = side(uid);
    const hp = rv.hp.reduce((a, h) => (h[0] <= m.tick ? h : a), rv.hp[0]);
    const y = ys(hp[1 + (s === "a" ? me : foe)]);
    return m.kind === "ko" ? `<g class="rv-mk ${s}"><title>${fmtTick(m.tick)} ${nameOf(uid)} が倒れた</title><circle cx="${xs(m.tick)}" cy="${y}" r="4.5"/></g>`
      : `<g class="rv-mk ult ${s}"><title>${fmtTick(m.tick)} ${nameOf(uid)} の奥義</title><path d="M${xs(m.tick)} ${y - 6}l2 4.5 5 .5-3.8 3.3 1.2 4.9-4.4-2.6-4.4 2.6 1.2-4.9-3.8-3.3 5-.5z"/></g>`;
  }).join("");
  const grid = [0.25, 0.5, 0.75].map(v => `<line class="rv-grid" x1="${P}" x2="${W - P}" y1="${ys(v * 1000)}" y2="${ys(v * 1000)}"/>`).join("");
  const minutes = [];
  for (let t = 1200; t < rv.end; t += 1200) minutes.push(`<line class="rv-grid" x1="${xs(t)}" x2="${xs(t)}" y1="${P}" y2="${H - P}"/><text class="rv-ax" x="${xs(t) + 3}" y="${H - P - 3}">${t / 1200}分</text>`);
  const sudden = rv.end > fr ? `<rect class="rv-sudden" x="${xs(fr)}" y="${P}" width="${xs(rv.end) - xs(fr)}" height="${H - 2 * P}"/>` : "";
  const graph = q("div", "rv-graph");
  graph.innerHTML = `<div class="rv-lab"><span class="rv-key a">こちら</span><span class="rv-key f">相手</span><span class="muted small">チームの HP の合計（%）。グラフを押すと、その少し前から再生</span></div>
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="両チームの HP の移り変わり">${sudden}${grid}${minutes.join("")}
    <polyline class="rv-line f" points="${line(foe)}"/><polyline class="rv-line a" points="${line(me)}"/>${marks}<line class="rv-cur" x1="-9" x2="-9" y1="${P}" y2="${H - P}"/></svg><div class="rv-tip num" hidden></div>`;
  const svg = graph.querySelector("svg"), cur = graph.querySelector(".rv-cur"), tip = graph.querySelector(".rv-tip");
  const tickAt = e => { const b = svg.getBoundingClientRect(); return Math.max(0, Math.min(rv.end, (e.clientX - b.left) / b.width * W - P) / (W - 2 * P) * rv.end); };
  svg.onpointermove = e => {
    const t = tickAt(e), hp = rv.hp.reduce((a, h) => (h[0] <= t ? h : a), rv.hp[0]);
    cur.setAttribute("x1", xs(t)), cur.setAttribute("x2", xs(t));
    tip.hidden = !1, tip.textContent = `${fmtTick(t)}　こちら ${Math.round(hp[1 + me] / 10)}%・相手 ${Math.round(hp[1 + foe] / 10)}%`;
  };
  svg.onpointerleave = () => { tip.hidden = !0, cur.setAttribute("x1", -9), cur.setAttribute("x2", -9); };
  svg.onclick = e => reviewJump(rep, opt, tickAt(e) - 60);
  box.append(graph);

  // チームの合計
  const T = rv.team;
  const tt = q("div", "rs-stats num rv-team");
  tt.innerHTML = '<span class="h"></span><span class="h a">こちら</span><span class="h f">相手</span>' + [
    ["与ダメージ", "dealt"], ["回復", "healed"], ["撃破", "kos"], ["奥義", "ult"], ["会心", "crit"], ["ホイールを回した", "rotate"], ["おはらい", "purify"], ["アイテム", "item"],
  ].map(([l, k]) => `<span>${l}</span><span class="a${T[me][k] > T[foe][k] ? " rv-top" : ""}">${T[me][k]}</span><span class="f${T[foe][k] > T[me][k] ? " rv-top" : ""}">${T[foe][k]}</span>`).join("");

  // 大きな出来事（押すとその場面へ）
  const mo = q("div", "rv-moments");
  mo.append(q("div", "hm-lab", "大きな出来事（押すとその場面から再生）"));
  const ml = q("div", "rv-mlist");
  const mtext = m => {
    switch (m.kind) {
      case "ko": return `${nameOf(m.dst)} が倒れた${m.src !== null && m.src !== void 0 ? `（${nameOf(m.src)}）` : ""}`;
      case "ult": return `${nameOf(m.src)} の${m.grand ? "大奥義" : "奥義"}「${ct.find(d => d.id === rv.units[m.src].unit).ultName}」`;
      case "crit": return `${nameOf(m.src)} の会心 ${m.amount}（→ ${nameOf(m.dst)}）`;
      case "big": return `${nameOf(m.src)} の大ダメージ ${m.amount}（→ ${nameOf(m.dst)}）`;
      case "revive": return `${nameOf(m.dst)} が復活`;
      case "sudden": return "サドンデス";
    }
    return "";
  };
  for (const m of rv.moments) {
    const uid = m.kind === "ko" || m.kind === "revive" ? m.dst : m.src;
    const b = q("button", `rv-m rv-k-${m.kind} ${uid === null || uid === void 0 ? "" : side(uid)}`);
    b.innerHTML = `<span class="num">${fmtTick(m.tick)}</span><span>${mtext(m)}</span>`;
    b.onclick = () => reviewJump(rep, opt, m.tick - 60);
    ml.append(b);
  }
  if (!rv.moments.length) ml.append(q("div", "muted small", "とくになし"));
  mo.append(ml);
  const mid = q("div", "rv-mid");
  mid.append(tt, mo);
  box.append(mid);

  // 妖怪ごと
  const cols = [["dealt", "与ダメ"], ["taken", "被ダメ"], ["healed", "回復"], ["kos", "撃破"], ["ult", "奥義"], ["crit", "会心"]];
  const table = q("div", "rv-scroll");
  const rows = sideIdx => {
    const us = rv.units.filter(u => u.owner === sideIdx);
    const best = Object.fromEntries(cols.map(([k]) => [k, Math.max(...rv.units.map(u => u[k]))]));
    const mvp = us.reduce((a, u) => (!a || u.dealt + u.healed > a.dealt + a.healed ? u : a), null);
    return us.map(u => {
      const d = ct.find(x => x.id === u.unit);
      const acts = [["attack", "こうげき"], ["skill", "ようじゅつ"], ["inspirit", "とりつく"], ["guard", "ガード"], ["loaf", "サボり"]];
      const total = acts.reduce((a, [k]) => a + u[k], 0) || 1;
      const bar = acts.map(([k, l]) => u[k] ? `<i class="ac ${k}" style="width:${u[k] * 100 / total}%" title="${l} ${u[k]} 回"></i>` : "").join("");
      const cursed = u.curseTry ? `<small title="とりつきが決まった回数 / ためした回数">とりつき ${u.curseHit}/${u.curseTry}</small>` : "";
      return `<tr class="${sideIdx === me ? "a" : "f"}"><th><span class="rv-pic" style="background:${Pi[d.tribe]}">${da(d.id, "")}</span><span class="rv-nm">${u.name}${u === mvp && u.dealt + u.healed > 0 ? '<em class="rv-mvp">MVP</em>' : ""}</span></th>
        ${cols.map(([k]) => `<td class="num${u[k] && u[k] === best[k] ? " rv-top" : ""}">${u[k]}</td>`).join("")}
        <td><span class="rv-acts">${bar}</span>${cursed}</td><td class="num">${fmtTick(u.onField)}</td><td class="num">${u.koAt === null ? "—" : fmtTick(u.koAt)}</td></tr>`;
    }).join("");
  };
  table.innerHTML = `<table class="rv-table"><thead><tr><th>妖怪</th>${cols.map(([, l]) => `<th>${l}</th>`).join("")}<th>行動の割合</th><th title="前衛にいた時間">前衛</th><th>気絶</th></tr></thead>
    <tbody><tr class="rv-sep"><td colspan="${cols.length + 4}">こちら</td></tr>${rows(me)}<tr class="rv-sep f"><td colspan="${cols.length + 4}">相手</td></tr>${rows(foe)}</tbody></table>
    <div class="rv-legend muted small"><i class="ac attack"></i>こうげき <i class="ac skill"></i>ようじゅつ <i class="ac inspirit"></i>とりつく <i class="ac guard"></i>ガード <i class="ac loaf"></i>サボり・行動できない</div>`;
  box.append(table);

  const row = q("div", "row");
  row.style.justifyContent = "center";
  const play = q("button", "btn primary", opt.player ? "続きを見る" : "最初から再生");
  play.onclick = () => {
    if (opt.player && Ga === opt.player) { close(); opt.player.replay.paused = !1, opt.player.replay.bar?.sync(); return; }
    reviewJump(rep, opt, 0);
  };
  const cl = q("button", "btn", "とじる");
  cl.onclick = close;
  row.append(cl, play);
  box.append(row);
  wrap.append(box);
  wrap.onclick = e => { e.target === wrap && close(); };
  document.addEventListener("keydown", onKey);
  document.body.append(wrap);
}
