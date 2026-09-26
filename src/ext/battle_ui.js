// ============================================================================
// 対戦画面の下画面：アイテム（右下）・パワーチャージ 4 種・おはらい 5 種
// e: 対戦の画面状態（Ga）。入力は zt(e, input) でエンジンへ送る。
// ============================================================================

// 名札に出す持ち物（装備）の名前
function eqLabel(u) {
  const eq = equipById(u.equipment ?? null);
  return eq ? eq.name : "";
}

// ---- メンバーサークル（サークル）を回す ----
// 指に遅れずについていく（なぞっている間は補間なし）。離すと 60° ごとの位置へぴたりと止まり、
// エンジンが回転を反映するまでその位置で待つ（以前は一瞬もとの位置に戻ってから跳んでいた）。
// CPU の回転・強制回転・キー操作のときも、絵が飛ばずに回って見えるようにする。
// 回転の待ち時間中は、少しだけ動いてから戻る（押せないことが手ざわりでわかる）。
function wheelSet(e, deg, instant = !1) {
  const r = e.svg.rotor;
  if (instant) r.classList.add("snap");
  r.style.transform = `rotate(${deg}deg)`;
  e.wheelDeg = deg;
  if (instant) r.getBoundingClientRect(), r.classList.remove("snap");
}

function wheelDrag(e, rad) {
  const deg = rad * 180 / Math.PI;
  if (e.wheelResist) { e.preview = 0; e.svg.rotor.style.transform = `rotate(${18 * Math.tanh(deg / 40)}deg)`; return; }
  const p = Math.max(-5, Math.min(5, Math.round(rad / (Math.PI / 3))));
  if (p !== e.preview) { qe(900 + Math.abs(p) * 60, 0.03, "square", 0.05); try { navigator.vibrate?.(6); } catch {} }
  e.preview = p;
  e.svg.rotor.style.transform = `rotate(${deg}deg)`;
  e.wheelDeg = deg;
}

// 回せなかった：もとの位置へ戻して赤く光らせる
function wheelDenied(e) {
  e.wheelResist = !1, e.preview = 0, e.wheelHold = null, wheelSet(e, 0);
  const w = e.svg.wheel;
  w.classList.remove("deny"), w.getBoundingClientRect(), w.classList.add("deny");
  qe(160, 0.12, "square", 0.08);
}

function wheelRelease(e, rad) {
  if (e.wheelResist) { wheelDenied(e); return; }
  const steps = Math.max(-5, Math.min(5, Math.round(rad / (Math.PI / 3))));
  if (!steps) { e.preview = 0; wheelSet(e, 0); return; }
  e.preview = steps;
  e.wheelHold = { deg: steps * 60, until: performance.now() + 900 };
  wheelSet(e, steps * 60);
  Ld(e);
}

// 毎フレーム：なぞっていないときの角度
// 行動のモーション中に回した分（pendingRotate）は、エンジンが反映するまでその角度で待つ
function wheelIdle(e) {
  if (e.svg.rotor.hasAttribute("data-drag")) return;
  const q = e.state.players[0].pendingRotate;
  if (q) {
    if (e.wheelHold) { e.wheelHold.until = performance.now() + 900; return; }
    const d = (q.dir === "cw" ? 1 : -1) * q.steps * 60;
    if ((e.wheelDeg ?? 0) !== d) wheelSet(e, d);
    return;
  }
  if (e.wheelHold) {
    if (performance.now() < e.wheelHold.until) return;
    e.wheelHold = null; // 回らなかった（はじかれた）ので戻す
  }
  const target = e.preview * 60;
  if ((e.wheelDeg ?? 0) !== target) wheelSet(e, target);
}

// メンバーサークルの並びが変わった：いま見えている角度から 0° へ回して見せる
function wheelChanged(e, oldKey, newKey) {
  if (!oldKey) { wheelSet(e, 0, !0); return; }
  const o = oldKey.split(",").map(Number), n = newKey.split(",").map(Number);
  let s = -1;
  for (let k = 0; k < 6 && s < 0; k++) if (o.every((v, d) => n[(d + k) % 6] === v)) s = k;
  const cur = e.wheelHold ? e.wheelHold.deg : e.wheelDeg ?? 0;
  e.wheelHold = null;
  if (s < 0) { wheelSet(e, 0, !0); return; }
  const start = (((cur - s * 60) + 180) % 360 + 360) % 360 - 180;
  wheelSet(e, start, !0);
  if (start) wheelSet(e, 0);
}

// ---- 右下「アイテム」 ----
function itemMenu(e, a) {
  const p = e.state.players[0];
  const key = `item:${p.bag.join(",")}:${p.itemCooldown > 0}:${e.fleeArm ?? ""}`;
  if (a.dataset.key === key) return;
  a.dataset.key = key;
  a.replaceChildren(q("div", "title", p.itemCooldown > 0 ? `アイテム（あと ${Ti(p.itemCooldown)} 秒）` : "アイテム：使うものを選ぶ"));
  const grid = q("div", "it-grid");
  if (!p.bag.length) grid.append(q("div", "muted", "アイテムがない"));
  p.bag.forEach((id, slot) => {
    const it = battleItem(id);
    const ok = [0, 1, 2, 3, 4, 5].some(pos => canUseItem(p, slot, pos));
    const b = q("button", "it-btn");
    b.disabled = !ok;
    b.innerHTML = `<span class="bag-ic ${it.kind}">${itemIcon(it)}</span><span><b>${it.name}</b><small>${itemDesc(it)}</small></span>`;
    b.onclick = () => {
      if (it.kind === "flee") {
        if (e.fleeArm !== slot) { e.fleeArm = slot; a.dataset.key = ""; return; }
        zt(e, { t: "item", slot, allySlot: 0 }); e.mode = "none"; e.fleeArm = null; return;
      }
      e.mode = "itemTarget", e.itemSlot = slot, e.fleeArm = null;
    };
    if (it.kind === "flee" && e.fleeArm === slot) b.classList.add("arm"), b.querySelector("small").textContent = "もう一度押すと逃げる";
    grid.append(b);
  });
  const c = q("button", "btn", "とじる");
  c.onclick = () => { e.mode = "none"; e.fleeArm = null; };
  a.append(grid, c);
}

// ---- パワーチャージ（本家の 4 種） ----
function chargeOverlay(e, a) {
  const p = e.state.players[0], s = p.stance;
  const g = CHARGE_GAMES[s.game];
  const u = p.units[s.unit];
  const key = `stance:${s.unit}:${s.startTick}`;
  if (a.dataset.key !== key) {
    a.dataset.key = key;
    a.replaceChildren();
    e.mg = { kind: s.game, acc: 0, balls: [], spawn: 0, lap: 0, next: 0, last: null, step: 0, full: !1 };
    const head = q("div", "mg-head");
    head.append(q("div", "mg-name", g.name), q("div", "title", `${Ze(u).name} の${s.grand ? "Gわざ" : "ひっさつわざ"}「${Ze(u).ultName}」`), q("div", "help", g.help));
    const stage = q("div", "mg-stage " + s.game + (s.grand ? " grand" : ""));
    const face = q("div", "mg-face");
    face.innerHTML = da(Ze(u).id, "");
    stage.append(q("div", "mg-rune"), face);
    const gauge = q("div", "gauge mg-gauge");
    gauge.append(q("i"));
    const row = q("div", "row");
    const cancel = q("button", "btn", "キャンセル");
    cancel.onclick = () => zt(e, { t: "ultCancel" });
    row.append(q("span", "mg-time num"), cancel);
    a.append(head, stage, gauge, row);
    setupCharge(e, stage, s.game);
  }
  const t = e.state.tick - s.startTick;
  const pw = Math.min(1, s.power / CHARGE_FULL), st = a.querySelector(".mg-stage"), gg = a.querySelector(".mg-gauge");
  gg.querySelector("i").style.width = jl(s.power, CHARGE_FULL);
  st.style.setProperty("--pw", pw.toFixed(3));
  // ゲージが 1/4 たまるごとに光る。満タンでひときわ大きく
  const step = Math.floor(pw * 4);
  if (step > e.mg.step) {
    e.mg.step = step;
    if (pw >= 1 && !e.mg.full) { e.mg.full = !0; st.classList.add("charged"); mgBurst(st, 50, 50, "perfect", 26); sfxCharged(); }
    else if (step < 4) { mgBurst(gg, pw * 100, 50, "good", 6); gg.classList.remove("pulse"), gg.offsetWidth, gg.classList.add("pulse"); }
  }
  const tm = a.querySelector(".mg-time");
  tm.textContent = s.game === "awasero" ? `あと ${Math.max(0, Math.ceil((CHARGE_FULL - s.power) / 340))} 回` : `のこり ${Math.max(0, Math.ceil((CHARGE_FULL - s.power) / 10))}%`;
  tm.className = "mg-time num";
  tickCharge(e, st, s);
}

function sendCharge(e, amount) {
  e.mg.acc += amount;
  while (e.mg.acc >= 10) {
    const n = Math.min(MAX_TAP, Math.floor(e.mg.acc));
    zt(e, { t: "ultCharge", amount: n });
    e.mg.acc -= n;
  }
}

function spinHandler(stage, onTurn) {
  let last = null;
  const ang = ev => { const r = stage.getBoundingClientRect(); return Math.atan2(ev.clientY - r.top - r.height / 2, ev.clientX - r.left - r.width / 2); };
  stage.onpointerdown = ev => { ev.preventDefault(); stage.setPointerCapture(ev.pointerId); last = ang(ev); };
  stage.onpointermove = ev => {
    if (last === null) return;
    const a = ang(ev);
    let d = a - last;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    last = a;
    onTurn(Math.abs(d) / (2 * Math.PI), a);
  };
  stage.onpointerup = stage.onpointercancel = () => { last = null; };
}

var STAR = Array.from({ length: 10 }, (_, i) => { const r = i % 2 ? 36 : 88, t = -Math.PI / 2 + i * Math.PI / 5; return [100 + r * Math.cos(t), 100 + r * Math.sin(t)]; });

function setupCharge(e, stage, kind) {
  if (kind === "mawase") {
    stage.insertAdjacentHTML("beforeend", '<div class="mg-ring"></div><div class="mg-arrow">⟳</div>');
    spinHandler(stage, (turn, a) => {
      sendCharge(e, turn * 300);
      stage.querySelector(".mg-arrow").style.transform = `rotate(${a * 180 / Math.PI + 90}deg)`;
      const now = performance.now();
      if (now - (e.mg.trail ?? 0) > 45) e.mg.trail = now, mgBurst(stage, 50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40, "trail", 2);
    });
  } else if (kind === "nazore") {
    const svg = Ke("svg", { viewBox: "0 0 200 200", class: "mg-svg" });
    svg.innerHTML = `<path d="M${STAR.map(p => p.join(" ")).join(" L")} Z" class="mg-path"/><polyline class="mg-done" points=""/>` + STAR.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="9" class="mg-pt" data-i="${i}"/>`).join("");
    stage.append(svg);
    const hit = ev => {
      const r = stage.getBoundingClientRect();
      const x = (ev.clientX - r.left) * 200 / r.width, y = (ev.clientY - r.top) * 200 / r.height;
      const [nx, ny] = STAR[e.mg.next];
      if (Math.hypot(nx - x, ny - y) < 24) {
        const done = e.mg.next;
        e.mg.next = (e.mg.next + 1) % STAR.length;
        if (e.mg.next === 0) { e.mg.lap++; sendCharge(e, 334); E2(!0); mgBurst(stage, nx / 2, ny / 2, "perfect", 18); }
        else { E2(!1); mgBurst(stage, nx / 2, ny / 2, "good", 5); }
        stage.querySelector(".mg-done")?.setAttribute("points", STAR.slice(0, e.mg.next ? done + 1 : 0).map(p => p.join(",")).join(" "));
      }
    };
    let down = !1;
    stage.onpointerdown = ev => { ev.preventDefault(); stage.setPointerCapture(ev.pointerId); down = !0; hit(ev); };
    stage.onpointermove = ev => { if (down) hit(ev); };
    stage.onpointerup = stage.onpointercancel = () => { down = !1; };
  } else if (kind === "ute") {
    stage.onpointerdown = ev => ev.preventDefault();
  } else if (kind === "awasero") {
    const dial = Ke("svg", { viewBox: "-100 -100 200 200", class: "mg-svg" });
    let marks = "";
    for (let i = 0; i < Di; i++) {
      const t = (-90 + i * 360 / Di) * Math.PI / 180, lit = iu.includes(i), near = nu.includes(i);
      marks += `<circle cx="${80 * Math.cos(t)}" cy="${80 * Math.sin(t)}" r="${lit ? 9 : 6}" class="mg-mark${lit ? " lit" : near ? " near" : ""}"/>`;
      if (lit && i === iu[0]) marks += `<text x="${62 * Math.cos(t)}" y="${62 * Math.sin(t) + 5}" class="mg-num" text-anchor="middle">${i + 1}</text>`;
    }
    dial.innerHTML = marks + '<line x1="0" y1="0" x2="0" y2="-72" class="mg-needle"/><circle r="8" class="mg-hub"/>';
    stage.append(dial);
    stage.onpointerdown = ev => { ev.preventDefault(); zt(e, { t: "ultRelease" }); };
  }
}

function tickCharge(e, stage, s) {
  if (!stage) return;
  if (s.game === "nazore") {
    stage.querySelectorAll(".mg-pt").forEach((c, i) => c.classList.toggle("next", i === e.mg.next));
  } else if (s.game === "awasero") {
    const n = (e.state.tick - s.startTick) % Di;
    stage.querySelector(".mg-needle")?.setAttribute("transform", `rotate(${n * 360 / Di})`);
    if (s.lastJudge && s.lastPress !== e.mg.last) {
      e.mg.last = s.lastPress;
      const j = q("div", "mg-judge " + s.lastJudge, s.lastJudge === "perfect" ? "ぴったり！" : s.lastJudge === "good" ? "おしい" : "ずれた");
      stage.append(j);
      setTimeout(() => j.remove(), 700);
      // 押したときの針の先で光を散らす
      const th = ((s.lastPress - s.startTick) % Di) * 2 * Math.PI / Di;
      mgBurst(stage, 50 + Math.sin(th) * 36, 50 - Math.cos(th) * 36, s.lastJudge, s.lastJudge === "perfect" ? 20 : s.lastJudge === "good" ? 10 : 4);
      stage.classList.remove("flash-perfect", "flash-good", "flash-miss"), stage.offsetWidth, stage.classList.add("flash-" + s.lastJudge);
      sfxJudge(s.lastJudge);
    }
  } else if (s.game === "ute") {
    const now = performance.now();
    if (now > e.mg.spawn) {
      e.mg.spawn = now + 220;
      const b = q("button", "mg-ball");
      const fromLeft = Math.random() < 0.5;
      const ball = { el: b, x: fromLeft ? -10 : 110, y: 15 + Math.random() * 70, vx: (fromLeft ? 1 : -1) * (30 + Math.random() * 25), vy: (Math.random() - 0.5) * 20, hit: !1 };
      b.onpointerdown = ev => { ev.preventDefault(); ev.stopPropagation(); if (ball.hit) return; ball.hit = !0; b.classList.add("hit"); sendCharge(e, 125); E2(!0); mgBurst(stage, ball.x, ball.y, "good", 8); };
      stage.append(b);
      e.mg.balls.push(ball);
    }
    const dt = e.mg.t ? Math.min(0.1, (now - e.mg.t) / 1000) : 0;
    e.mg.t = now;
    e.mg.balls = e.mg.balls.filter(ball => {
      ball.x += ball.vx * dt, ball.y += ball.vy * dt;
      ball.el.style.left = `${ball.x}%`, ball.el.style.top = `${ball.y}%`;
      if (ball.x < -15 || ball.x > 115) { ball.el.remove(); return !1; }
      return !0;
    });
  }
}

// ---- おはらい（本家の 5 種） ----
// 後衛の妖怪を選んだ：いま「あとで」にしているおはらいの妖怪なら、画面を開きなおして続きから
function purifyPick(e, slot) {
  const p = e.state.players[0];
  if (p.purify && p.wheel[slot] === p.purify.unit) { e.purifyHidden = null; return; }
  zt(e, { t: "purify", allySlot: slot });
}

function purifyOverlay(e, a) {
  const p = e.state.players[0], pu = p.purify;
  const u = p.units[pu.unit];
  const g = PURIFY_GAMES[pu.game];
  const key = `purify:${pu.unit}:${pu.game}`;
  if (a.dataset.key !== key) {
    a.dataset.key = key;
    a.replaceChildren();
    e.pg = { acc: 0, spots: [], spawn: 0, crack: null, t: 0 };
    const head = q("div", "mg-head");
    head.append(q("div", "mg-name purify", "おはらい：" + g.name), q("div", "title", `${Ze(u).name} の ${Wl[u.curse?.kind] ?? "とりつき"} をはらう`), q("div", "help", g.help));
    const stage = q("div", "mg-stage purify " + pu.game);
    const face = q("div", "mg-face");
    face.innerHTML = da(Ze(u).id, "");
    stage.append(face, q("div", "mg-chains"));
    const gauge = q("div", "gauge mg-gauge purify");
    gauge.append(q("i"));
    const later = q("button", "btn", "あとで（もう一度この妖怪をおはらいすると続きから）");
    later.onclick = () => { e.purifyHidden = pu.unit; a.dataset.key = ""; };
    a.append(head, stage, gauge, later);
    setupPurify(e, stage, pu.game);
  }
  a.querySelector(".mg-gauge i").style.width = jl(pu.progress, PURIFY_FULL);
  tickPurify(e, a.querySelector(".mg-stage"), pu.game);
}

function sendPurify(e, amount) {
  e.pg.acc += amount;
  while (e.pg.acc >= 10) {
    const n = Math.min(MAX_TAP, Math.floor(e.pg.acc));
    zt(e, { t: "purifyTap", amount: n });
    e.pg.acc -= n;
  }
}

function setupPurify(e, stage, kind) {
  if (kind === "mawase") {
    stage.insertAdjacentHTML("beforeend", '<div class="mg-ring"></div><div class="mg-arrow">⟳</div>');
    spinHandler(stage, (turn, a) => {
      sendPurify(e, turn * 200);
      stage.querySelector(".mg-arrow").style.transform = `rotate(${a * 180 / Math.PI + 90}deg)`;
      const now = performance.now();
      if (now - (e.pg.trail ?? 0) > 60) e.pg.trail = now, mgBurst(stage, 50 + Math.cos(a) * 40, 50 + Math.sin(a) * 40, "purify", 2);
    });
  } else if (kind === "kosure") {
    let last = null;
    stage.onpointerdown = ev => { ev.preventDefault(); stage.setPointerCapture(ev.pointerId); last = [ev.clientX, ev.clientY]; };
    stage.onpointermove = ev => {
      if (!last) return;
      const d = Math.hypot(ev.clientX - last[0], ev.clientY - last[1]);
      last = [ev.clientX, ev.clientY];
      sendPurify(e, d * 0.4);
      if (d > 6 && Math.random() < 0.3) { const [x, y] = pctPoint(stage, ev); mgBurst(stage, x, y, "purify", 2); }
      stage.style.setProperty("--rub", String((parseFloat(stage.style.getPropertyValue("--rub") || "0") + d) % 360));
    };
    stage.onpointerup = stage.onpointercancel = () => { last = null; };
  } else if (kind === "kire") {
    let start = null;
    stage.onpointerdown = ev => { ev.preventDefault(); stage.setPointerCapture(ev.pointerId); start = pctPoint(stage, ev); };
    stage.onpointerup = ev => {
      if (!start || !e.pg.crack) return;
      const end = pctPoint(stage, ev), c = e.pg.crack;
      if (segCross(start, end, c.a, c.b)) {
        sendPurify(e, 250); E2(!0); e.pg.crack.el.remove(); e.pg.crack = null;
        mgBurst(stage, (start[0] + end[0]) / 2, (start[1] + end[1]) / 2, "perfect", 14);
        const cut = Ke("svg", { viewBox: "0 0 100 100", class: "mg-cut", preserveAspectRatio: "none" });
        cut.innerHTML = `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}"/>`;
        stage.append(cut), setTimeout(() => cut.remove(), 400);
      }
      start = null;
    };
  } else {
    stage.onpointerdown = ev => ev.preventDefault();
  }
}

function pctPoint(stage, ev) { const r = stage.getBoundingClientRect(); return [(ev.clientX - r.left) * 100 / r.width, (ev.clientY - r.top) * 100 / r.height]; }
function segCross(p1, p2, p3, p4) {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return d(p1, p2, p3) * d(p1, p2, p4) < 0 && d(p3, p4, p1) * d(p3, p4, p2) < 0;
}

function tickPurify(e, stage, kind) {
  if (!stage) return;
  const now = performance.now();
  if (kind === "tsubuse" || kind === "renda") {
    if (now > e.pg.spawn && e.pg.spots.length < (kind === "renda" ? 3 : 6)) {
      e.pg.spawn = now + (kind === "renda" ? 900 : 380);
      const b = q("button", kind === "renda" ? "mg-spot" : "mg-bubble");
      b.style.left = `${10 + Math.random() * 80}%`;
      b.style.top = `${10 + Math.random() * 80}%`;
      const spot = { el: b, until: now + (kind === "renda" ? 1600 : 2400), hits: 0 };
      b.onpointerdown = ev => {
        ev.preventDefault(); ev.stopPropagation();
        const [px, py] = [parseFloat(b.style.left), parseFloat(b.style.top)];
        if (kind === "tsubuse") { sendPurify(e, 80); b.classList.add("pop"); spot.until = now; E2(!0); mgBurst(stage, px, py, "purify", 8); }
        else { sendPurify(e, 60); spot.hits++; b.classList.remove("tap"); b.offsetWidth; b.classList.add("tap"); E2(!1); mgBurst(stage, px, py, "purify", 3); }
      };
      stage.append(b);
      e.pg.spots.push(spot);
    }
    e.pg.spots = e.pg.spots.filter(s => {
      if (performance.now() < s.until) return !0;
      setTimeout(() => s.el.remove(), 150);
      return !1;
    });
  } else if (kind === "kire" && !e.pg.crack) {
    const a = [15 + Math.random() * 30, 10 + Math.random() * 80], b = [55 + Math.random() * 30, 10 + Math.random() * 80];
    const el = Ke("svg", { viewBox: "0 0 100 100", class: "mg-crack", preserveAspectRatio: "none" });
    el.innerHTML = `<polyline points="${a[0]},${a[1]} ${(a[0] + b[0]) / 2 + 4},${(a[1] + b[1]) / 2 - 6} ${b[0]},${b[1]}"/>`;
    stage.append(el);
    // なぞる線は「ヒビに交差する」向きで判定するので、ヒビそのものの端点を保存
    e.pg.crack = { a, b, el };
  }
}

// 下画面の重ね表示：どれを出すか
function bottomOverlay(e) {
  const p = e.state.players[0], a = e.refs.overlay;
  if (p.stance) { a.hidden = !1; a.className = "overlay mg"; chargeOverlay(e, a); return !0; }
  if (p.poke) { a.className = "overlay"; return !1; } // もとの「つつく」表示を使う
  if (e.mode === "item") { a.hidden = !1; a.className = "overlay mg"; itemMenu(e, a); return !0; }
  if (p.purify && e.purifyHidden !== p.purify.unit) { a.hidden = !1; a.className = "overlay mg"; purifyOverlay(e, a); return !0; }
  if (a.className !== "overlay") a.className = "overlay";
  return null;
}

// テスト用（URL に #debug を付けたときだけ）
function debugHook() {
  if (!location.hash.includes("debug")) return;
  window.__yokaiDebug = {
    ga: () => Ga, send: (i) => zt(Ga, i), lobby: () => openPvpLobby(),
    // パーティ保存：いまの編成・書き出しの文字列・読みこみ
    party: () => partyStore(), bt: () => bt.map(id => id && ct.find(x => x.id === id).name), loadout: () => SLOT_LOADOUT, bag: () => BAG,
    partyCode: () => partyEncode(partyFromBuilder("test")), partyImport: code => partyApply(partyDecode(code)),
    team: () => teamMembers().map(m => `${ct.find(x => x.id === m.unit).name}${m.equipment ? "(" + equipById(m.equipment).name + ")" : ""}`).join("・"),
    // 流行りの型：ルール違反・持ち物の付けそこね
    presets: () => PRESETS.map(p => { const ms = presetMembers(p); return { name: p.name, errs: ms ? Yn(ms) : ["妖怪が見つからない"], dropped: ms ? p.team.filter((t, i) => t[2] && !ms[i].equipment).map(t => `${t[0]}:${t[2]}`) : [] }; }),
    // 奥義の振り付けの数（全員）
    ultStats() { const c = {}; for (const d of ct) { const k = ultStyleOf(d); c[k] = (c[k] ?? 0) + 1; } return c; },
    // 奥義の振り付けを 1 つ試す（手前のまん中の妖怪を、その振り付けの妖怪に見立てる）
    ultTry(style) {
      const d = ct.find(x => ultStyleOf(x) === style && ["all", "curseAll", "heal", "blessAll"].includes(x.ult.kind) === ["rain", "bloom"].includes(style)) ?? ct.find(x => ultStyleOf(x) === style);
      if (!d) return null;
      const p = Ga.state.players, me = p[0].units[p[0].wheel[1]].uid, foe = p[1].units[p[1].wheel[1]].uid, f = Ga.scene.figs.get(me);
      f.def = d, window.__ultUid = me;
      Ga.scene.action(me, foe, "ult", Id(d.ult.element ?? null));
      return `${d.name}（${d.ult.kind}${d.ult.element ? "・" + d.ult.element : ""}）`;
    },
    // 演出の確認用：出来事を 1 つ画面に流す（dst:-1 は敵の前衛 i 番目、-2 はこちらの前衛 0 番目）
    play(ev) {
      const p = Ga.state.players, uidOf = (pl, i) => p[pl].units[p[pl].wheel[i]].uid;
      if (ev.dst === -1) ev = { ...ev, dst: uidOf(1, ev.i ?? 0), src: uidOf(0, 0) };
      if (ev.dst === -2) ev = { ...ev, dst: uidOf(0, 0), src: uidOf(1, 0) };
      Od(Ga, ev);
    },
    // エンジンから出た出来事の並びとして画面に流す（遅らせて見せる・HP を止める も含めて）
    events(list) { playEvents(Ga, list); },
    tribe: i => ct[i].tribe,
    // 陣の確認用：同じ族（猛）の 3 体と、ばらばらの族の 3 体
    twoTribes() {
      const idx = t => ct.findIndex(d => d.tribe === t);
      return [ct.map((d, i) => [d, i]).filter(([d]) => d.tribe === "takeru").slice(0, 3).map(x => x[1]), ["ayashi", "tsuwamono", "kage"].map(idx)];
    },
    // 自分の側を CPU に操作させる（対人戦の通しテスト用）
    autoplay(params = or[3].params) {
      let cpu = null, g = null;
      return setInterval(() => {
        if (!Ga || !Ga.running) return;
        if (g !== Ga) g = Ga, cpu = null;
        const me = Ga.net?.role === "guest" ? 1 : 0, st = me ? Ga.canon : Ga.state;
        cpu ??= Nh(me, 12345 + me, params);
        for (const i of Bh(cpu, st)) zt(Ga, i);
      }, 50);
    },
  };
}
