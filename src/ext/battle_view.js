// ============================================================================
// 対戦画面の「見えている状態」と演出の段取り。
//   ・HP は、ダメージの数字が出た瞬間に減る（エンジンは先に減らしているので、画面では遅れて減らす）
//   ・多段の技は、ダメージを当たった数に分けて 1 発ずつ数字とヒットストップを出す
//   ・陣：メンバーサークルを回して陣ができたら、カットインで見せる
//   ・とりつき：よい／わるいとりつき中の妖怪に、ずっとオーラを出す
// ============================================================================

// ---- 見えている HP・生死 ----
function viewOf(e, uid) {
  e.view ??= new Map();
  let v = e.view.get(uid);
  if (!v) {
    const u = Ot(e, uid);
    v = { hp: u.hp, alive: Se(u), hold: 0, busyUntil: 0 };
    e.view.set(uid, v);
  }
  return v;
}

// 演出待ちの出来事がないユニットは、エンジンの値にそろえる
function syncView(e) {
  for (const p of e.state.players) for (const u of p.units) {
    const v = viewOf(e, u.uid);
    if (v.hold > 0) continue;
    v.hp = u.hp, v.alive = Se(u);
  }
}
function viewHp(e, u) { return viewOf(e, u.uid).hp; }
function viewAlive(e, u) { return viewOf(e, u.uid).alive; }

// 遅れて見せる出来事の相手（HP をそこで止めておく）
function viewUidOf(ev) {
  switch (ev.t) {
    case "damage": case "heal": case "curse": return ev.dst;
    case "ko": case "doll": case "endure": return ev.uid;
  }
  return null;
}
function viewHold(e, ev) {
  const uid = viewUidOf(ev);
  if (uid !== null && uid !== void 0) viewOf(e, uid).hold++;
}
function viewRelease(e, ev) {
  const uid = viewUidOf(ev);
  if (uid !== null && uid !== void 0) { const v = viewOf(e, uid); v.hold = Math.max(0, v.hold - 1); }
}

// 奥義の振り付けで何発当てるか（エンジンに段数がない妖怪のとき）
function ultMotionHits(def) {
  const st = ultStyleOf(def);
  if (st === "rush") return ultVariant(def).hits;
  if (st === "stretch") return 2;
  if (st === "phantom" && !["all", "curseAll"].includes(def.ult?.kind)) return 3;
  return 1;
}

// ダメージを見せる（多段なら分けて 1 発ずつ）。eff は弱点(1)／いまひとつ(-1)
function showDamage(e, ev, eff) {
  const r = e.scene, def = ev.src !== null && ev.src !== void 0 ? Ze(Ot(e, ev.src)) : null;
  let n = ev.hits ?? (ev.source === "ult" && def ? ultMotionHits(def) : 1);
  n = Math.max(1, Math.min(n, ev.amount, 12));
  const gap = ev.source === "ult" ? 210 : 120;
  const v = viewOf(e, ev.dst);
  const parts = [];
  let left = ev.amount;
  for (let k = 0; k < n; k++) { const a = k === n - 1 ? left : Math.floor(ev.amount / n); parts.push(a), left -= a; }
  const color = ev.crit ? 16767334 : ev.source === "attack" ? 16777215 : 16765562;
  v.hold++;
  v.busyUntil = Math.max(v.busyUntil, performance.now() + (n - 1) * gap + 40);
  parts.forEach((amt, k) => {
    const last = k === n - 1;
    const go = () => {
      v.hp = Math.max(0, v.hp - amt);
      const crit = ev.crit && last; // クリティカルの派手な演出は最後の 1 発に
      r.hit(ev.dst, crit, color);
      if (n > 1) r.hitStop = Math.max(r.hitStop, last ? 0.16 : 0.07); // 1 発ごとに止める
      dmgPop(e, { ...ev, amount: amt, crit, part: n > 1 ? k + 1 : 0 }, eff);
      if (n > 1 && !last) qe(700 + k * 60, 0.05, "square", 0.08);
      if (last) v.hold = Math.max(0, v.hold - 1);
    };
    k === 0 ? go() : setTimeout(go, k * gap);
  });
}

// 倒れる・こらえるは、多段の最後の 1 発が出てから
function viewDefer(e, ev) {
  if (ev.t !== "ko" && ev.t !== "endure" && ev.t !== "doll") return !1;
  const v = viewOf(e, ev.uid), wait = v.busyUntil - performance.now();
  if (wait <= 0) return !1;
  v.hold++;
  setTimeout(() => { v.hold = Math.max(0, v.hold - 1); Od(e, ev); }, wait);
  return !0;
}

// ---- 陣（同じ族が前衛でとなり合う）----
var JIN_FX = {
  takeru: "ちから", ayashi: "ようりょく", tsuwamono: "まもり", kage: "すばやさ",
  miyabi: "能力を下げるとりつきが当たりやすい", tatari: "毒・封じなどのとりつきが当たりやすい",
  shizume: "悪いとりつきを受けにくい", nagomi: "回復量",
};
function jinOf(p) {
  const out = new Map();
  for (let pos = 0; pos < 3; pos++) {
    const u = p.units[p.wheel[pos]];
    if (!Se(u) || Bi(u) === "maga") continue;
    const b = Li(p, u);
    if (!b) continue;
    const t = Bi(u);
    const cur = out.get(t) ?? { bonus: 0, uids: [] };
    cur.bonus = Math.max(cur.bonus, b), cur.uids.push(u.uid);
    out.set(t, cur);
  }
  return out;
}
function jinText(tribe, bonus) {
  const w = JIN_FX[tribe], pct = Math.round(bonus / 10);
  return ["takeru", "ayashi", "tsuwamono", "kage", "nagomi"].includes(tribe) ? `${w} +${pct}%` : w;
}
// 回転の出来事のあと：回す前の並びとくらべて、新しくできた（強くなった）陣を見せる
function jinAfterRotate(e, ev) {
  const p = e.state.players[ev.player];
  let before;
  if (ev.t === "forcedRotate") { const w = p.wheel; before = [w[3], w[4], w[5], w[0], w[1], w[2]]; }
  else {
    const l = ev.dir === "cw" ? ev.steps : 6 - ev.steps;
    before = new Array(6);
    for (let d = 0; d < 6; d++) before[d] = p.wheel[(d + l) % 6];
  }
  const old = jinOf({ units: p.units, wheel: before }), now = jinOf(p);
  const fresh = [...now].filter(([t, j]) => !old.has(t) || old.get(t).bonus < j.bonus);
  if (fresh.length) jinCutin(e, ev.player, fresh);
}
function jinCutin(e, pid, list) {
  const top = e.refs.top;
  if (!top) return;
  top.querySelector(".jincut")?.remove();
  const ally = pid === 0;
  const el = q("div", "jincut " + (ally ? "ally" : "foe"));
  const [tribe, j] = list[0];
  el.style.setProperty("--jc", Pi[tribe] ?? "#f2a541");
  const band = q("div", "jc-band");
  const mark = q("div", "jc-mark", Hl[tribe].slice(0, 1));
  const txt = q("div", "jc-txt");
  txt.append(q("span", "jc-kind", (ally ? "" : "敵の") + "陣形効果" + (j.bonus >= _h ? "（3 体）" : "（2 体）")),
    q("span", "jc-name", list.map(([t]) => `${Hl[t]}族`).join("・")),
    q("span", "jc-fx", list.map(([t, x]) => jinText(t, x.bonus)).join(" / ")));
  const arts = q("div", "jc-arts");
  for (const uid of j.uids) { const a = q("div", "jc-art"); a.innerHTML = da(Ze(Ot(e, uid)).id, ""); arts.append(a); }
  band.append(mark, arts, txt);
  el.append(band);
  top.append(el);
  setTimeout(() => el.remove(), 1400);
  for (const uid of j.uids) e.scene.jinFx?.(uid, Pi[tribe] ?? "#f2a541");
  qe(523, 0.1, "triangle", 0.14), qe(784, 0.14, "triangle", 0.14, 0.08), qe(1047, 0.2, "triangle", 0.12, 0.16);
}

// ---- とりつきのオーラ（毎フレーム） ----
function inspiritAuras(e) {
  const s = e.scene;
  for (const p of e.state.players) for (const u of p.units) {
    if (!Se(u) || !viewAlive(e, u)) continue;
    if (u.curse) s.inspAura(u.uid, "bad");
    else if (u.blessing) s.inspAura(u.uid, "good");
  }
}

Object.assign(e2.prototype, {
  // 陣ができた瞬間：足もとに族の色の輪
  jinFx(uid, css) {
    const f = this.figs.get(uid);
    if (!f) return;
    const c = N2(css);
    this.shockwave(f.root.position, c, 1.8, 0.6);
    this.pillar(f.root.position, c, 3, 0.5, 0.8);
  },
  // とりつき中ずっと出すオーラ。よい＝金と緑の光が立ちのぼる、わるい＝紫の煙がまとわりつく
  inspAura(uid, kind) {
    const f = this.figs.get(uid);
    if (!f || !f.root.visible) return;
    this.fxInit();
    this.insp ??= new Map();
    let a = this.insp.get(uid);
    if (a && a.kind !== kind) { this.scene.remove(a.ring); a.ring.material.dispose(); this.insp.delete(uid); a = null; }
    if (!a) {
      const ring = new pt(FX_RING, kind === "good" ? fxMat(0xf2d15c, 0.5) : new Aa({ color: 0x6a2aa0, transparent: !0, opacity: 0.6, depthWrite: !1, side: ca }));
      ring.rotation.x = -Math.PI / 2;
      this.scene.add(ring);
      a = { kind, ring, spawn: 0 };
      this.insp.set(uid, a);
    }
    a.seen = !0;
  },
  inspUpdate(dt) {
    if (!this.insp) return;
    for (const [uid, a] of this.insp) {
      const f = this.figs.get(uid);
      if (!a.seen || !f || !f.root.visible) {
        this.scene.remove(a.ring), a.ring.material.dispose(), this.insp.delete(uid);
        continue;
      }
      a.seen = !1; // 毎フレーム inspAura で生かし直す
      const p = f.root.position, t = this.clock, h = f.model.userData.height ?? 1.6;
      const good = a.kind === "good";
      const r = 0.8 + Math.sin(t * (good ? 3 : 2)) * 0.06;
      a.ring.position.set(p.x, 0.05, p.z), a.ring.scale.set(r, r, 1), a.ring.rotation.z = t * (good ? 1.2 : -0.8);
      a.ring.material.opacity = good ? 0.35 + Math.sin(t * 4) * 0.12 : 0.5 + Math.sin(t * 3) * 0.1;
      a.spawn -= dt;
      if (a.spawn > 0 || this.reduced) continue;
      a.spawn = good ? 0.12 : 0.1;
      const ang = Math.random() * 6.28, rr = 0.35 + Math.random() * 0.4, x = p.x, z = p.z;
      if (good) {
        const s = new Rl(new An({ map: this.glow(), color: Math.random() < 0.5 ? 0xf2d15c : 0x9cf08a, transparent: !0, depthWrite: !1, blending: hi }));
        this.fxAdd(s, 1.1, k => { s.position.set(x + Math.cos(ang) * rr, 0.1 + k * h * 1.3, z + Math.sin(ang) * rr); s.scale.setScalar(0.16 * (1 - k * 0.5)); s.material.opacity = Math.sin(k * Math.PI); });
      } else {
        // わるいとりつき：加算しない暗い煙が体のまわりを回りながら上へ
        const s = new Rl(new An({ map: this.glow(), color: Math.random() < 0.4 ? 0x9a5ad0 : 0x2a1440, transparent: !0, depthWrite: !1 }));
        this.fxAdd(s, 1.3, k => { const aa = ang + k * 4; s.position.set(x + Math.cos(aa) * rr, 0.3 + k * h * 0.9, z + Math.sin(aa) * rr); s.scale.setScalar(0.35 + k * 0.4); s.material.opacity = 0.55 * Math.sin(k * Math.PI); });
      }
    }
  },
});
(() => {
  const P = e2.prototype, upd = P.update;
  P.update = function (dt) {
    this.inspUpdate(this.hitStop > 0 ? dt * 0.2 : dt);
    upd.call(this, dt);
  };
})();
