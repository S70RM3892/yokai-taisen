// ============================================================================
// 3D の対戦画面のエフェクトを盛る。
// もとの e2（対戦の 3D シーン）のメソッドを包んで、光の粒・衝撃波・光の柱・斬撃の弧・
// 奥義チャージ中のオーラ・回復／とりつきの演出・舞い散る花びらを足す。
// three.js の名前：Rl=Sprite, An=SpriteMaterial, M1=RingGeometry, pd=Cylinder, Aa=MeshBasicMaterial,
//   pt=Mesh, qr=Group, D=Vector3, hi=AdditiveBlending, ca=DoubleSide, Ei=Plane
// ============================================================================

var FX_RING = null, FX_ARC = null, FX_TUBE = null, FX_PETAL = null;
function fxGeo() {
  if (!FX_RING) {
    FX_RING = new M1(0.82, 1, 48);
    FX_ARC = new M1(0.9, 1, 32, 1, 0, Math.PI * 0.9);
    FX_TUBE = new pd(1, 1, 1, 24, 1, !0);
    FX_PETAL = new Ei(0.12, 0.08);
  }
}

function fxMat(color, opacity = 1) {
  return new Aa({ color, transparent: !0, opacity, depthWrite: !1, blending: hi, side: ca });
}

Object.assign(e2.prototype, {
  fxInit() {
    if (this.fx) return;
    fxGeo();
    this.fx = [];
    this.auras = new Map();
    this.petals = [];
    this.camPunch = 0;
    const n = this.reduced ? 0 : 26;
    for (let i = 0; i < n; i++) {
      const m = new pt(FX_PETAL, new Aa({ color: i % 3 ? 0xf6c1d6 : 0xfbe3ec, transparent: !0, opacity: 0.8, side: ca, depthWrite: !1 }));
      m.position.set((Math.random() - 0.5) * 16, Math.random() * 7, -8 + Math.random() * 12);
      this.scene.add(m);
      this.petals.push({ m, vx: 0.2 + Math.random() * 0.3, vy: 0.35 + Math.random() * 0.3, spin: Math.random() * 3, ph: Math.random() * 6 });
    }
  },

  // 1 つのエフェクト：obj を置き、毎フレーム step(k, dt) を呼ぶ（k は 0→1 の進み）。終われば消す
  fxAdd(obj, dur, step) {
    this.fxInit();
    this.scene.add(obj);
    this.fx.push({ obj, t: 0, dur, step });
    return obj;
  },

  // 光の粒（スプライト）
  sparkle(pos, color, n = 12, speed = 2.4, size = 0.28, up = 0.6, life = 0.7) {
    if (this.reduced) n = Math.min(n, 3);
    for (let i = 0; i < n; i++) {
      const s = new Rl(new An({ map: this.glow(), color, transparent: !0, depthWrite: !1, blending: hi }));
      const v = new D(Math.random() - 0.5, Math.random() * up + (up > 0 ? 0.2 : -0.1), Math.random() - 0.5).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      const sz = size * (0.6 + Math.random() * 0.8), L = life * (0.7 + Math.random() * 0.6);
      s.position.copy(pos);
      s.scale.setScalar(sz);
      this.fxAdd(s, L, (k, dt) => {
        v.y -= 3.2 * dt, v.multiplyScalar(1 - 1.5 * dt);
        s.position.addScaledVector(v, dt);
        s.material.opacity = 1 - k;
        s.scale.setScalar(sz * (1 - k * 0.6));
      });
    }
  },

  // ぱっと光る
  flare(pos, color, size = 1.6, dur = 0.28) {
    const s = new Rl(new An({ map: this.glow(), color, transparent: !0, depthWrite: !1, blending: hi }));
    s.position.copy(pos);
    this.fxAdd(s, dur, k => { s.scale.setScalar(size * (0.4 + k * 0.9)); s.material.opacity = (1 - k) * 0.95; });
  },

  // 地面を走る衝撃波
  shockwave(pos, color, radius = 2, dur = 0.5, y = 0.05) {
    const m = new pt(FX_RING, fxMat(color, 0.9));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, y, pos.z);
    this.fxAdd(m, dur, k => { const r = 0.2 + radius * (1 - (1 - k) * (1 - k)); m.scale.set(r, r, 1); m.material.opacity = 0.9 * (1 - k); });
  },

  // カメラの方を向いた斬撃の弧
  slash(pos, color, size = 1.1) {
    const m = new pt(FX_ARC, fxMat(color, 1));
    m.position.copy(pos);
    m.lookAt(this.camera.position);
    m.rotateZ(Math.random() * Math.PI * 2);
    this.fxAdd(m, 0.32, k => { const s = size * (0.6 + k * 0.7); m.scale.set(s, s, 1); m.rotateZ(0.12); m.material.opacity = 1 - k; });
  },

  // 立ちのぼる光の柱
  pillar(pos, color, height = 5, radius = 0.7, dur = 1.1) {
    const m = new pt(FX_TUBE, fxMat(color, 0.6));
    m.position.set(pos.x, height / 2, pos.z);
    this.fxAdd(m, dur, k => {
      const r = radius * (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) * 0.6);
      m.scale.set(r, height * Math.min(1, k * 4), r);
      m.material.opacity = 0.65 * (1 - k);
    });
  },

  // 回復：緑の粒が上へ
  healFx(uid) {
    const f = this.figs.get(uid);
    if (!f) return;
    const p = f.root.position.clone();
    this.shockwave(p, 0x7fd46b, 1.1, 0.6);
    for (let i = 0; i < (this.reduced ? 2 : 10); i++) {
      const s = new Rl(new An({ map: this.glow(), color: i % 2 ? 0x9cf08a : 0xd8ffc8, transparent: !0, depthWrite: !1, blending: hi }));
      const a = Math.random() * 6.28, r = 0.3 + Math.random() * 0.4, d = i * 0.05;
      this.fxAdd(s, 1 + d, k => {
        const kk = Math.max(0, k * (1 + d) - d);
        s.position.set(p.x + Math.cos(a + kk * 4) * r, 0.2 + kk * 2.2, p.z + Math.sin(a + kk * 4) * r);
        s.scale.setScalar(0.22 * (1 - kk * 0.5));
        s.material.opacity = kk > 0 ? 1 - kk : 0;
      });
    }
  },

  // よいとりつき：光の輪が足もとから上へ
  blessFx(uid, color = 0x4cc2a4) {
    const f = this.figs.get(uid);
    if (!f) return;
    const p = f.root.position;
    const m = new pt(FX_RING, fxMat(color, 0.9));
    m.rotation.x = -Math.PI / 2;
    this.fxAdd(m, 0.9, k => { m.position.set(p.x, 0.1 + k * 2, p.z); const r = 0.9 - k * 0.3; m.scale.set(r, r, 1); m.material.opacity = 0.9 * (1 - k); });
    this.sparkle(p.clone().setY(1), color, 8, 1.2, 0.2, 1);
  },

  // わるいとりつき：紫の粒がまわりを渦巻く
  curseFx(uid) {
    const f = this.figs.get(uid);
    if (!f) return;
    const p = f.root.position.clone();
    for (let i = 0; i < (this.reduced ? 2 : 9); i++) {
      const s = new Rl(new An({ map: this.glow(), color: i % 2 ? 0xb07ce0 : 0x6a2aa0, transparent: !0, depthWrite: !1, blending: hi }));
      const a0 = i / 9 * 6.28;
      this.fxAdd(s, 1.1, k => {
        const a = a0 + k * 9, r = 0.9 - k * 0.7;
        s.position.set(p.x + Math.cos(a) * r, 1.6 - k * 1.2, p.z + Math.sin(a) * r);
        s.scale.setScalar(0.3);
        s.material.opacity = Math.sin(k * Math.PI);
      });
    }
  },

  // PERFECT で撃ったとき：金色の輪と粒
  perfectFx(uid) {
    const f = this.figs.get(uid);
    if (!f) return;
    this.shockwave(f.root.position, 0xf2d15c, 4.2, 0.7);
    this.shockwave(f.root.position, 0xfff6c8, 2.8, 0.55, 0.3);
    this.sparkle(f.root.position.clone().setY(1.2), 0xf2d15c, 30, 4.2, 0.32, 1, 0.9);
    this.flare(f.root.position.clone().setY(1.2), 0xfff2a0, 4, 0.4);
  },

  // 奥義のパワーチャージ中：足もとの陣と立ちのぼる光（ゲージがたまるほど強く）
  chargeAura(uid, power, grand) {
    const f = this.figs.get(uid);
    if (!f) return;
    this.fxInit();
    let a = this.auras.get(uid);
    if (!a) {
      const color = grand ? 0xf2a541 : 0x9ad0ff;
      const ring = new pt(FX_RING, fxMat(color, 0.8)), ring2 = new pt(FX_RING, fxMat(0xffffff, 0.5));
      ring.rotation.x = ring2.rotation.x = -Math.PI / 2;
      const col = new pt(FX_TUBE, fxMat(color, 0.25));
      // 光源を足すと全部のシェーダーが作り直しになって止まるので、光はスプライトで見せる
      const light = new Rl(new An({ map: this.glow(), color, transparent: !0, depthWrite: !1, blending: hi }));
      light.position.y = 0.9;
      const g = new qr();
      g.add(ring, ring2, col, light);
      this.scene.add(g);
      a = { g, ring, ring2, col, light, color, power: 0, seen: 0, spawn: 0, grand };
      this.auras.set(uid, a);
    }
    a.power = power, a.seen = this.clock, a.alive = !0;
  },

  fxUpdate(dt) {
    this.fxInit();
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const e = this.fx[i];
      e.t += dt;
      const k = Math.min(1, e.t / e.dur);
      e.step(k, dt);
      if (k >= 1) {
        this.scene.remove(e.obj);
        e.obj.material?.dispose();
        this.fx.splice(i, 1);
      }
    }
    for (const [uid, a] of this.auras) {
      const f = this.figs.get(uid);
      if (!a.alive || !f) {
        this.scene.remove(a.g);
        for (const m of [a.ring, a.ring2, a.col, a.light]) m.material.dispose();
        this.auras.delete(uid);
        continue;
      }
      a.alive = !1; // 毎フレーム chargeAura で生かし直す
      const p = f.root.position, w = a.power, t = this.clock;
      a.g.position.set(p.x, 0, p.z);
      const r = 0.9 + w * 0.5 + Math.sin(t * 6) * 0.05;
      a.ring.position.y = 0.06, a.ring.scale.set(r, r, 1), a.ring.rotation.z = t * 1.5;
      a.ring.material.opacity = 0.5 + w * 0.5;
      const r2 = (t * 1.2 % 1) * r;
      a.ring2.position.y = 0.07, a.ring2.scale.set(r2, r2, 1), a.ring2.material.opacity = 0.6 * (1 - r2 / r);
      a.col.scale.set(0.55 + w * 0.3, 1 + w * 3.5, 0.55 + w * 0.3), a.col.position.y = (1 + w * 3.5) / 2;
      a.col.material.opacity = 0.08 + w * 0.3 + Math.sin(t * 14) * 0.04;
      a.light.scale.setScalar(1.6 + w * 2.4 + Math.sin(t * 9) * 0.15), a.light.material.opacity = 0.25 + w * 0.5;
      a.spawn -= dt;
      if (a.spawn <= 0 && !this.reduced) {
        a.spawn = 0.09 - w * 0.06;
        const s = new Rl(new An({ map: this.glow(), color: Math.random() < 0.3 ? 0xffffff : a.color, transparent: !0, depthWrite: !1, blending: hi }));
        const ang = Math.random() * 6.28, rr = 0.3 + Math.random() * 0.6, sp = 1.4 + w * 2.6, x = p.x, z = p.z;
        this.fxAdd(s, 0.9, k => { s.position.set(x + Math.cos(ang + k * 2) * rr * (1 - k * 0.5), 0.1 + k * sp, z + Math.sin(ang + k * 2) * rr * (1 - k * 0.5)); s.scale.setScalar(0.2 + w * 0.15); s.material.opacity = 1 - k; });
      }
    }
    // 花びら
    for (const pe of this.petals) {
      pe.m.position.x += pe.vx * dt * 0.6 + Math.sin(this.clock * 1.3 + pe.ph) * 0.004;
      pe.m.position.y -= pe.vy * dt * 0.6;
      pe.m.rotation.set(this.clock * pe.spin, this.clock * pe.spin * 0.7, pe.ph);
      if (pe.m.position.y < 0) pe.m.position.set((Math.random() - 0.5) * 16 - 3, 6 + Math.random() * 2, -8 + Math.random() * 12);
    }
    // 投げたものの尾
    if (!this.reduced) for (const pr of this.projectiles) {
      const s = new Rl(new An({ map: this.glow(), color: pr.color, transparent: !0, depthWrite: !1, blending: hi }));
      s.position.copy(pr.mesh.position);
      const sz = pr.big ? 0.7 : 0.4;
      this.fxAdd(s, 0.3, k => { s.scale.setScalar(sz * (1 - k)); s.material.opacity = 0.8 * (1 - k); });
    }
    // 奥義で一瞬カメラが寄る
    this.camPunch = Math.max(0, this.camPunch - dt * 1.6);
  },
});

// もとのメソッドを包む
(() => {
  const P = e2.prototype, orig = {};
  for (const k of ["hit", "ko", "action", "cast", "update", "shoot"]) orig[k] = P[k];
  P.hit = function (uid, crit, color = 0xffffff) {
    orig.hit.call(this, uid, crit, color);
    const f = this.figs.get(uid);
    if (!f) return;
    const h = f.model.userData.height ?? 1.6, p = f.root.position.clone().setY(h * 0.55);
    this.hitStop = Math.max(this.hitStop, crit ? 0.24 : 0.06); // 当たった瞬間に止める（クリティカルは長く）
    if (!crit) {
      // ふつう：白い光と小さな火花、斬撃 1 本
      this.flare(p, color, 1.3, 0.22);
      this.sparkle(p, color, 7, 2.2, 0.22);
      this.slash(p, 0xffffff, 0.9);
      return;
    }
    // クリティカル：金の大きな光、斬撃 3 本、金のかけら、二重の衝撃波
    this.flare(p, 0xfff2a0, 3.6, 0.35);
    this.flare(p, 0xffffff, 1.8, 0.18);
    for (let i = 0; i < 3; i++) this.slash(p, i === 1 ? 0xffffff : 0xf2c14a, 1.5 + i * 0.35);
    this.sparkle(p, 0xf2d15c, 30, 4.4, 0.3, 0.9, 0.9);
    this.sparkle(p, 0xffffff, 10, 3, 0.18);
    this.shockwave(f.root.position, 0xf2a541, 2.8, 0.5);
    this.shockwave(f.root.position, 0xfff2a0, 1.6, 0.35, 0.4);
  };
  P.ko = function (uid) {
    orig.ko.call(this, uid);
    this.hitStop = Math.max(this.hitStop, 0.24);
    const f = this.figs.get(uid);
    if (!f) return;
    this.shockwave(f.root.position, 0x9ad0ff, 2.6, 0.7);
    this.shockwave(f.root.position, 0xffffff, 1.6, 0.5);
    this.flare(f.root.position.clone().setY(1), 0xc0d8ff, 3, 0.45);
    // 黒い煙
    for (let i = 0; i < (this.reduced ? 2 : 10); i++) {
      const s = new Rl(new An({ map: this.glow(), color: 0x2a2440, transparent: !0, depthWrite: !1 }));
      const p = f.root.position.clone(), a = Math.random() * 6.28, sp = 0.6 + Math.random() * 0.8;
      this.fxAdd(s, 1.2, k => { s.position.set(p.x + Math.cos(a) * k * sp, 0.3 + k * 1.2, p.z + Math.sin(a) * k * sp); s.scale.setScalar(0.5 + k * 1.2); s.material.opacity = 0.7 * (1 - k); });
    }
  };
  P.action = function (uid, target, kind, color) {
    // 奥義は一体ずつの振り付け（ult_motion.js）。使えないときだけもとの動き
    const ult = kind === "ult" || kind === "grand";
    if (!(ult && this.startUlt(uid, target, kind === "grand", color))) orig.action.call(this, uid, target, kind, color);
    const f = this.figs.get(uid);
    if (!f) return;
    if (ult) {
      const g = kind === "grand";
      this.pillar(f.root.position, g ? 0xf2a541 : color, g ? 8 : 5.5, g ? 1.1 : 0.75, g ? 1.4 : 1);
      this.pillar(f.root.position, 0xffffff, g ? 8 : 5.5, g ? 0.45 : 0.3, g ? 1.2 : 0.8);
      this.shockwave(f.root.position, color, g ? 5 : 3.2, 0.8);
      this.shockwave(f.root.position, 0xffffff, g ? 3.5 : 2.2, 0.6);
      this.sparkle(f.root.position.clone().setY(0.5), color, g ? 40 : 24, 4, 0.35, 1.2, 1);
      this.camPunch = g ? 1 : 0.6;
    } else if (kind === "skill") {
      this.shockwave(f.root.position, color, 1.2, 0.45);
      this.sparkle(f.root.position.clone().setY(1), color, 6, 1.4, 0.22, 1);
    } else if (kind === "attack") {
      this.sparkle(f.root.position.clone().setY(0.1), 0xd8d0c0, 5, 1.2, 0.3, 0.2, 0.5); // 踏み込みの土ぼこり
    }
  };
  P.cast = function (uid, color) {
    orig.cast.call(this, uid, color);
    const f = this.figs.get(uid);
    if (f) this.shockwave(f.root.position, color, 1.4, 0.5);
  };
  P.shoot = function (a, b, color, big) {
    orig.shoot.call(this, a, b, color, big);
    this.flare(a.root.position.clone().setY(1.1), color, big ? 1.8 : 1.1, 0.25);
  };
  P.update = function (dt) {
    this.fxUpdate(this.hitStop > 0 ? dt * 0.2 : dt); // 止まっているあいだは光も遅く
    // 奥義のときだけ画角をすこし狭めて寄る（もとの update がカメラを置き直したあとに効く）
    const fov = 42 - this.camPunch * 5;
    if (Math.abs(this.camera.fov - fov) > 0.01) this.camera.fov = fov, this.camera.updateProjectionMatrix();
    orig.update.call(this, dt);
  };
})();

// ---- 下画面（パワーチャージ・おはらい）の DOM エフェクト ----
// host の中の (x, y)（% 指定）で、光の輪と火花を散らす
function mgBurst(host, x, y, kind = "good", n = 10) {
  if (!host || Ga?.scene?.reduced) n = Math.min(n, 3);
  if (!host) return;
  const wave = q("span", "mg-wave " + kind);
  wave.style.left = x + "%", wave.style.top = y + "%";
  host.append(wave);
  setTimeout(() => wave.remove(), 650);
  for (let i = 0; i < n; i++) {
    const s = q("span", "mg-spark " + kind);
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * (kind === "perfect" ? 70 : 45);
    s.style.left = x + "%", s.style.top = y + "%";
    s.style.setProperty("--dx", `${Math.cos(a) * d}px`), s.style.setProperty("--dy", `${Math.sin(a) * d}px`);
    s.style.animationDelay = `${Math.random() * 60}ms`;
    host.append(s);
    setTimeout(() => s.remove(), 700);
  }
}

// 判定の音
function sfxJudge(kind) {
  if (kind === "perfect") { [1319, 1760, 2093, 2637].forEach((f, i) => qe(f, 0.16, "triangle", 0.16, i * 0.045)); Tt(0.25, 0.18, "highpass", 6e3, 0.05); }
  else if (kind === "good") { qe(988, 0.12, "triangle", 0.16), qe(1319, 0.16, "triangle", 0.14, 0.05); }
  else qe(180, 0.18, "square", 0.1, 0, 90);
  try { navigator.vibrate?.(kind === "perfect" ? [18, 30, 18] : kind === "good" ? 14 : 40); } catch {}
}

function sfxCharged() {
  Tt(0.5, 0.35, "bandpass", 400, 0, 1.5, 4e3), qe(330, 0.4, "sawtooth", 0.12, 0, 1320), qe(660, 0.5, "triangle", 0.12, 0.1, 1760);
}

// ---- ダメージの数字・クリティカルの演出・連続ヒット ----
// 与えたダメージは白〜金、受けたダメージは赤。クリティカルは大きな金の数字に「CRITICAL!!」、放射線、
// 一瞬の止め（ヒットストップ）と画面のフラッシュ。こちらの攻撃が続くと「○ HIT」と合計を数える。
function dmgPop(e, ev, eff) {
  const p = e.scene.project(ev.dst, 2);
  if (!p.visible) return;
  const taken = ev.dst < ii, crit = !!ev.crit;
  const size = ev.amount >= 160 ? " huge" : ev.amount >= 90 ? " big" : "";
  const el = q("div", `dnum ${crit ? "crit" : "norm"}${size} ${taken ? "taken" : "dealt"}${eff > 0 ? " weak" : ""}${ev.source === "ult" ? " ult" : ""}`);
  el.style.left = `${p.x + (Math.random() - 0.5) * 36}px`;
  el.style.top = `${p.y - Math.random() * 12}px`;
  if (crit) el.append(q("span", "drays"), q("span", "dlab", "CRITICAL!!"));
  const val = q("span", "dval", "0");
  el.append(val);
  e.refs.fx.append(el);
  // 数字がくるくる上がって止まる（大きいほど長く）
  const dur = crit ? 320 : Math.min(260, 90 + ev.amount), t0 = performance.now();
  const roll = () => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    val.textContent = String(Math.round(ev.amount * (1 - (1 - k) ** 3)));
    if (k < 1 && el.isConnected) requestAnimationFrame(roll);
  };
  roll();
  setTimeout(() => el.remove(), crit ? 1500 : 1050);
  if (crit) critBurst(e, ev, p);
  comboHit(e, ev);
}

function critBurst(e, ev, p) {
  const top = e.refs.top, sc = e.scene;
  if (!sc.reduced) {
    const fl = q("div", "critflash" + (ev.dst < ii ? " taken" : ""));
    fl.style.setProperty("--x", `${p.x}px`), fl.style.setProperty("--y", `${p.y}px`);
    top.append(fl);
    setTimeout(() => fl.remove(), 520);
  }
  sc.hitStop = Math.max(sc.hitStop, 0.26);
  sc.camShake = Math.max(sc.camShake, 0.42);
  sc.flashLevel = Math.max(sc.flashLevel, 0.3);
  sfxCrit();
}

function comboHit(e, ev) {
  if (ev.src === null || ev.src === void 0 || ev.src >= ii || ev.dst < ii) return;
  const now = performance.now();
  let c = e.combo;
  if (!c || now - c.t > 2600) {
    c?.el.remove();
    c = e.combo = { n: 0, total: 0, crits: 0, t: now, el: q("div", "combo") };
    e.refs.top.append(c.el);
  }
  c.n++, c.total += ev.amount, c.t = now, ev.crit && c.crits++;
  const word = c.n >= 12 ? "ぶっとび！！" : c.n >= 8 ? "すごい！" : c.n >= 5 ? "いいぞ！" : "";
  c.el.innerHTML = `<b class="num">${c.n}</b><span class="hit">HIT</span><span class="tot num">${c.total}</span>${word ? `<span class="word">${word}</span>` : ""}`;
  c.el.className = "combo" + (ev.crit ? " gold" : "") + (c.n >= 8 ? " hot" : "");
  c.el.style.animation = "none", c.el.offsetWidth, c.el.style.animation = "";
  clearTimeout(c.timer);
  c.timer = setTimeout(() => { c.el.classList.add("out"); setTimeout(() => c.el.remove(), 400); if (e.combo === c) e.combo = null; }, 2600);
  if (c.n > 1) qe(520 + Math.min(c.n, 16) * 45, 0.07, "triangle", 0.1); // 続くほど音が上がる
}

function sfxCrit() {
  Tt(0.08, 0.5, "highpass", 2500, 0, 0.8);
  qe(1760, 0.12, "square", 0.12, 0.02, 2640), qe(2637, 0.22, "triangle", 0.14, 0.07), qe(3520, 0.26, "sine", 0.1, 0.12);
  qe(90, 0.3, "sine", 0.5, 0, 40);
}
