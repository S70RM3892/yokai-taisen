// ============================================================================
// ようじゅつ（術）のエフェクトと、状態のしるし。本家の見せ方に寄せる：
//   術の陣 … 術を使う妖怪の足もとに、属性の字（火・水・雷・土・氷・風・癒・吸）を書いた陣が回る
//   火 … 相手の足もとから火柱／水 … 上から水が落ちて弾ける／雷 … 空から稲妻／土 … 岩が落ちる（大は隕石）
//   氷 … 氷のとげが地面から突き出る／風 … 相手を竜巻が包む／吸収 … 相手から光の玉を吸いとる／回復 … 味方に緑の光
//   術の強さ（火花→火炎→れんごく のような 3 段階）で大きさと数が変わる
// 状態のしるし（毎フレーム）：ガード中の六角の結界・行動できない（★が回る）・混乱（？が回る）・サボり中（Z）
// ============================================================================

var SPELL_KANJI = { fire: "火", water: "水", thunder: "雷", earth: "土", ice: "氷", wind: "風", heal: "癒", drain: "吸", none: "妖" };
var SPELL_COLOR = { fire: 0xff6a2a, water: 0x3aa0ff, thunder: 0xffe04a, earth: 0xc89a5a, ice: 0xa8e8ff, wind: 0x7ee08a, heal: 0x7fd46b, drain: 0xd04a8a, none: 0xb07ce0 };
var FX_PLANE = null, FX_CONE = null;

Object.assign(e2.prototype, {
  // 術の陣のテクスチャ（属性ごとに 1 枚）
  circleTex(kind) {
    this.circTex ??= new Map();
    if (this.circTex.has(kind)) return this.circTex.get(kind);
    const cv = document.createElement("canvas");
    cv.width = cv.height = 256;
    const g = cv.getContext("2d"), ch = SPELL_KANJI[kind] ?? "妖";
    g.strokeStyle = "#fff", g.fillStyle = "#fff";
    g.lineWidth = 7, g.beginPath(), g.arc(128, 128, 118, 0, 7), g.stroke();
    g.lineWidth = 3, g.beginPath(), g.arc(128, 128, 98, 0, 7), g.stroke();
    g.beginPath(), g.arc(128, 128, 62, 0, 7), g.stroke();
    // 六芒星
    g.lineWidth = 3;
    for (const off of [0, Math.PI / 3]) {
      g.beginPath();
      for (let i = 0; i <= 3; i++) { const a = off + i * Math.PI * 2 / 3 - Math.PI / 2; g[i ? "lineTo" : "moveTo"](128 + Math.cos(a) * 98, 128 + Math.sin(a) * 98); }
      g.stroke();
    }
    // 外周の小さな字
    g.font = "bold 16px serif", g.textAlign = "center", g.textBaseline = "middle";
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      g.save(), g.translate(128 + Math.cos(a) * 108, 128 + Math.sin(a) * 108), g.rotate(a + Math.PI / 2), g.fillText(i % 2 ? ch : "妖", 0, 0), g.restore();
    }
    g.font = "bold 70px serif", g.fillText(ch, 128, 132);
    const tex = new Tn(cv);
    this.circTex.set(kind, tex);
    return tex;
  },

  // 足もとの陣（dur 秒で出て消える）
  spellCircle(f, element, color, dur, where = null, size = 1) {
    FX_PLANE ??= new Ei(1, 1);
    const kind = element ?? "none";
    const m = new pt(FX_PLANE, new Aa({ map: this.circleTex(color === SPELL_COLOR.heal ? "heal" : kind), color, transparent: !0, depthWrite: !1, blending: hi, side: ca }));
    m.rotation.x = -Math.PI / 2;
    const p = (where ?? f.root.position).clone();
    this.fxAdd(m, dur, k => {
      const s = size * 1.9 * (k < 0.15 ? easeOutK(k / 0.15) : 1);
      m.position.set(p.x, 0.04, p.z), m.scale.set(s, s, 1), m.rotation.z = k * 2.4;
      m.material.opacity = k > 0.8 ? (1 - k) / 0.2 : 0.95;
    });
    this.sparkle(p.clone().setY(0.2), color, 8, 1.2, 0.2, 1.2, 0.9);
  },

  // 術の本体。o = { element, heal, drain, tier, all, target }
  spellFx(f, o, color) {
    const tier = o.tier ?? 0, big = 1 + tier * 0.35;
    const foes = [...this.figs.values()].filter(x => x.ally !== f.ally && x.root.visible && x.alive);
    const mates = [...this.figs.values()].filter(x => x.ally === f.ally && x.root.visible && x.alive);
    if (o.heal) {
      for (const m of mates) { this.pillar(m.root.position, SPELL_COLOR.heal, 3.2, 0.5, 0.9); this.leaves(m.root.position, 0x9cf08a, 10); }
      return;
    }
    const tf = o.target != null ? this.figs.get(o.target) : null;
    const targets = o.all ? foes : tf ? [tf] : foes.slice(1, 2);
    const el = o.drain ? "drain" : o.element ?? "none";
    const c = SPELL_COLOR[el] ?? color;
    for (const t of targets) {
      const p = t.root.position.clone();
      this.spellCircle(f, el, c, 0.7, p, 0.8 + tier * 0.15); // 相手の足もとにも陣
      switch (el) {
        case "fire": this.fireSpell(p, big, tier); break;
        case "water": this.waterSpell(p, big, tier); break;
        case "thunder": this.thunderSpell(p, big, tier); break;
        case "earth": this.earthSpell(p, big, tier); break;
        case "ice": this.iceSpell(p, big, tier); break;
        case "wind": this.windSpell(p, big, tier); break;
        case "drain": this.drainSpell(p, f, big); break;
        default: this.later(0.25, () => { this.flare(p.clone().setY(1), c, 3 * big, 0.35); this.sparkle(p.clone().setY(1), c, 16, 3, 0.26); this.shockwave(p, c, 2 * big, 0.45); });
      }
    }
  },

  fireSpell(p, big, tier) {
    // 地面が赤く光ってから、火柱が上がる
    this.shockwave(p, 0xff9a2a, 1.2 * big, 0.25);
    this.later(0.25, () => {
      this.pillar(p, 0xff6a2a, 3.5 * big, 0.55 * big, 0.8);
      this.pillar(p, 0xffe0a0, 3 * big, 0.25 * big, 0.6);
      this.flare(p.clone().setY(1), 0xffa040, 3 * big, 0.35);
      for (let i = 0; i < (this.reduced ? 4 : 16 + tier * 10); i++) {
        const s = new Rl(new An({ map: this.glow(), color: i % 3 ? 0xff6a2a : 0xffd060, transparent: !0, depthWrite: !1, blending: hi }));
        const a = Math.random() * 6.28, r = Math.random() * 0.5 * big, sp = 2 + Math.random() * 2.5 * big, L = 0.5 + Math.random() * 0.4;
        this.fxAdd(s, L, k => { s.position.set(p.x + Math.cos(a) * r * (1 + k), 0.1 + k * sp, p.z + Math.sin(a) * r * (1 + k)); s.scale.setScalar((0.45 - k * 0.3) * big); s.material.opacity = 1 - k; });
      }
      if (tier >= 2) this.shockwave(p, 0xff4a1a, 3.4, 0.6), this.camShake = Math.max(this.camShake, 0.3);
    });
  },

  waterSpell(p, big, tier) {
    // 上から水が落ちてくる
    const n = this.reduced ? 4 : 14 + tier * 8;
    for (let i = 0; i < n; i++) {
      const s = new Rl(new An({ map: this.glow(), color: i % 2 ? 0x3aa0ff : 0xc8ecff, transparent: !0, depthWrite: !1, blending: hi }));
      const dx = (Math.random() - 0.5) * 0.9 * big, dz = (Math.random() - 0.5) * 0.6, d0 = Math.random() * 0.1;
      this.fxAdd(s, 0.3, k => { const kk = clamp01(k * 1.1 - d0); s.position.set(p.x + dx, 6 - 5.8 * easeInK(kk), p.z + dz); s.scale.set(0.25 * big, 0.7 * big, 1); s.material.opacity = kk > 0 ? 0.9 : 0; });
    }
    this.later(0.25, () => {
      this.shockwave(p, 0x3aa0ff, 2.2 * big, 0.5);
      this.shockwave(p, 0xffffff, 1.3 * big, 0.35, 0.2);
      this.pillar(p, 0x6ac0ff, 2 * big, 0.45 * big, 0.45);
      this.sparkle(p.clone().setY(0.4), 0x9ad8ff, 18 + tier * 8, 3.2 * big, 0.2, 1.4, 0.7);
    });
  },

  thunderSpell(p, big, tier) {
    const bolts = 1 + tier;
    for (let b = 0; b < bolts; b++) this.later(0.18 + b * 0.07, () => this.bolt(p.clone().add(new D((Math.random() - 0.5) * 0.5 * b, 0, 0)), big));
    this.flare(p.clone().setY(6), 0xfff6a0, 2.5, 0.4); // 雷雲の光
    this.later(0.25, () => { this.flashLevel = Math.max(this.flashLevel, 0.3 + tier * 0.1); this.shockwave(p, 0xffe04a, 1.8 * big, 0.35); this.sparkle(p.clone().setY(1), 0xfff6a0, 14, 3.4, 0.2); });
  },
  // 稲妻：空から地面まで、ぎざぎざの線
  bolt(p, big) {
    const pts = [p.clone().setY(7)];
    for (let i = 1; i < 7; i++) pts.push(new D(p.x + (Math.random() - 0.5) * 0.7, 7 - i, p.z + (Math.random() - 0.5) * 0.3));
    pts.push(p.clone().setY(0.2));
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      for (const [w, col] of [[0.2 * big, 0xffe04a], [0.07 * big, 0xffffff]]) {
        const m = new pt(FX_TUBE, fxMat(col, 1));
        m.position.copy(a).lerp(b, 0.5), m.lookAt(b), m.rotateX(Math.PI / 2);
        const len = a.distanceTo(b);
        this.fxAdd(m, 0.45, k => { m.scale.set(w, len, w); m.material.opacity = k < 0.6 ? (Math.random() < 0.85 ? 1 : 0.3) : (1 - k) / 0.4; }); // ちらつきながら消える
      }
    }
    this.flare(p.clone().setY(0.6), 0xfff6a0, 2.4 * big, 0.25);
  },

  earthSpell(p, big, tier) {
    if (tier >= 2) {
      // いん石：火をまとった大岩が斜めに落ちる
      const m = new pt(geo().sph, new Aa({ color: 0x6a4a2a }));
      const from = p.clone().add(new D(-3, 8, 0));
      this.fxAdd(m, 0.28, k => { m.position.lerpVectors(from, p.clone().setY(0.5), easeInK(k)); m.scale.setScalar(0.6); m.rotation.x += 0.3; if (Math.random() < 0.8) this.flare(m.position.clone(), 0xff7a2a, 1.4, 0.25); });
      this.later(0.26, () => this.groundCrack(p, 0xff7a2a)), this.later(0.26, () => this.shockwave(p, 0xffa040, 3.2, 0.6));
      return;
    }
    const n = this.reduced ? 2 : 3 + tier * 3;
    for (let i = 0; i < n; i++) {
      const m = new pt(geo().box, new Aa({ color: i % 2 ? 0x8a6a4a : 0x6a5238 }));
      const dx = (Math.random() - 0.5) * 1.1, dz = (Math.random() - 0.5) * 0.6, s = (0.25 + Math.random() * 0.2) * big, d0 = i * 0.06;
      this.fxAdd(m, 0.3 + d0, k => { const kk = clamp01((k * (0.3 + d0) - d0) / 0.3); m.position.set(p.x + dx, 6 - 5.6 * easeInK(kk), p.z + dz); m.scale.setScalar(kk > 0 ? s : 0); m.rotation.set(kk * 6, kk * 4, 0); });
    }
    this.later(0.26, () => this.groundCrack(p, 0xc89a5a));
  },

  iceSpell(p, big, tier) {
    FX_CONE ??= geo().cone;
    this.later(0.23, () => {
      const n = this.reduced ? 3 : 6 + tier * 4;
      for (let i = 0; i < n; i++) {
        const m = new pt(FX_CONE, new Aa({ color: i % 2 ? 0xa8e8ff : 0xe8f8ff, transparent: !0, opacity: 0.85 }));
        const a = i / n * 6.28, r = 0.45 + (i % 3) * 0.15, h = (0.8 + Math.random() * 0.6) * big;
        this.fxAdd(m, 0.8, k => {
          const up = easeOutK(clamp01(k / 0.2));
          m.position.set(p.x + Math.cos(a) * r, h * 0.5 * up - 0.1, p.z + Math.sin(a) * r);
          m.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35);
          m.scale.set(0.18 * big, h * up, 0.18 * big);
          m.material.opacity = k > 0.7 ? (1 - k) / 0.3 * 0.85 : 0.85;
        });
      }
      this.flare(p.clone().setY(1), 0xe8f8ff, 2.6 * big, 0.3);
      this.shockwave(p, 0xa8e8ff, 1.8 * big, 0.45);
      this.later(0.45, () => this.sparkle(p.clone().setY(0.8), 0xe8f8ff, 18, 2.8, 0.18, 0.8));
    });
  },

  windSpell(p, big, tier) {
    const g = new qr();
    const rings = [0, 1, 2].map(i => { const m = new pt(FX_TUBE, fxMat(i === 1 ? 0xffffff : 0x7ee08a, 0.35)); g.add(m); return m; });
    this.fxAdd(g, 0.9, k => {
      const w = Math.sin(clamp01(k / 0.9) * Math.PI);
      g.position.set(p.x, 1.2 * big, p.z), g.rotation.y += 0.45;
      rings.forEach((m, i) => { m.scale.set((0.8 - i * 0.2) * w * big, (2.4 + i * 0.4) * big, (0.8 - i * 0.2) * w * big); m.material.opacity = 0.35 * w; });
    });
    setTimeout(() => { for (const m of rings) m.material.dispose(); }, 1000);
    this.leaves(p, 0x7ee08a, 12 + tier * 6, true);
  },
  // 葉っぱ（風・回復）：くるくる回りながら舞う
  leaves(p, color, n, spiral = false) {
    FX_PLANE ??= new Ei(1, 1);
    for (let i = 0; i < (this.reduced ? 3 : n); i++) {
      const m = new pt(FX_PLANE, new Aa({ color: i % 2 ? color : 0xd8ffc8, transparent: !0, side: ca, depthWrite: !1 }));
      const a0 = Math.random() * 6.28, r = 0.4 + Math.random() * 0.5, L = 0.8 + Math.random() * 0.4;
      this.fxAdd(m, L, k => {
        const a = a0 + k * (spiral ? 10 : 3);
        m.position.set(p.x + Math.cos(a) * r, 0.2 + k * 2.4, p.z + Math.sin(a) * r);
        m.scale.set(0.14, 0.09, 1), m.rotation.set(k * 9, k * 7, a);
        m.material.opacity = Math.sin(k * Math.PI);
      });
    }
  },

  drainSpell(p, f, big) {
    // 相手から光の玉が吸い出され、術者に入る
    const to = f.root.position.clone().setY(1);
    for (let i = 0; i < (this.reduced ? 3 : 9); i++) {
      const s = new Rl(new An({ map: this.glow(), color: i % 2 ? 0xd04a8a : 0xff9ad0, transparent: !0, depthWrite: !1, blending: hi }));
      const from = p.clone().setY(1).add(new D((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0)), d0 = 0.25 + i * 0.05;
      this.fxAdd(s, d0 + 0.5, k => {
        const kk = clamp01((k * (d0 + 0.5) - d0) / 0.5);
        s.position.lerpVectors(from, to, easeInK(kk)); s.position.y += Math.sin(kk * Math.PI) * 0.8;
        s.scale.setScalar(0.3 * big * (k * (d0 + 0.5) >= d0 ? 1 : 0)); s.material.opacity = 1 - kk * 0.5;
      });
    }
    this.later(0.25, () => { this.flare(p.clone().setY(1), 0xd04a8a, 2.2 * big, 0.3); this.shockwave(p, 0xd04a8a, 1.4, 0.4); });
    this.later(0.8, () => this.flare(to, 0xff9ad0, 1.8, 0.3));
  },

  // ---- 状態のしるし（毎フレーム statusMark で生かし、なければ消える）----
  statusMark(uid, kind) {
    const f = this.figs.get(uid);
    if (!f || !f.root.visible) return;
    this.marks ??= new Map();
    const key = uid + ":" + kind;
    let m = this.marks.get(key);
    if (!m) {
      FX_HEX ??= new M1(0.9, 1, 6, 1);
      const objs = [];
      if (kind === "guard") for (let i = 0; i < 2; i++) { const o = new pt(FX_HEX, fxMat(i ? 0xffffff : 0x6ab8ff, 0.4)); objs.push(o); }
      else if (kind === "stun" || kind === "confuse") for (let i = 0; i < 3; i++) objs.push(this.textSprite(kind === "stun" ? "★" : "？", kind === "stun" ? 0xf2d15c : 0xd8a0ff));
      else if (kind === "sleep") for (let i = 0; i < 3; i++) objs.push(this.textSprite("Z", 0x9ad0ff));
      for (const o of objs) this.scene.add(o);
      m = { kind, objs, uid };
      this.marks.set(key, m);
    }
    m.seen = !0;
  },
  marksUpdate() {
    if (!this.marks) return;
    const t = this.clock;
    for (const [key, m] of this.marks) {
      const f = this.figs.get(m.uid);
      if (!m.seen || !f || !f.root.visible) {
        for (const o of m.objs) this.scene.remove(o), o.material.dispose();
        this.marks.delete(key);
        continue;
      }
      m.seen = !1;
      const p = f.root.position, h = f.model.userData.height ?? 1.6;
      if (m.kind === "guard") {
        const toCam = this.camera.position.clone().sub(p).setY(0).normalize();
        m.objs.forEach((o, i) => {
          o.position.set(p.x, h * 0.55, p.z).add(toCam.clone().multiplyScalar(0.55 + i * 0.02));
          o.lookAt(this.camera.position);
          o.rotateZ(t * (i ? -0.6 : 0.4));
          const s = h * (0.85 + i * 0.12) * (1 + Math.sin(t * 4 + i) * 0.02);
          o.scale.set(s, s, 1);
          o.material.opacity = (i ? 0.25 : 0.4) + Math.sin(t * 3) * 0.08;
        });
      } else if (m.kind === "sleep") {
        m.objs.forEach((o, i) => { const k = (t * 0.6 + i / 3) % 1; o.position.set(p.x + 0.3 + k * 0.4, h + k * 0.8, p.z); o.scale.setScalar(0.2 + k * 0.25); o.material.opacity = Math.sin(k * Math.PI); });
      } else {
        m.objs.forEach((o, i) => { const a = t * 3 + i / 3 * 6.28; o.position.set(p.x + Math.cos(a) * 0.45, h + 0.1 + Math.sin(t * 5 + i) * 0.05, p.z + Math.sin(a) * 0.45); o.scale.setScalar(0.28); o.material.opacity = 0.95; });
      }
    }
  },
});

// 毎フレーム：ガード中・行動できない・混乱・サボり中のしるし
function statusFx(e) {
  const s = e.scene;
  if (!s.statusMark) return;
  for (const p of e.state.players) for (let pos = 0; pos < 3; pos++) {
    const u = p.units[p.wheel[pos]];
    if (!Se(u) || !viewAlive(e, u)) continue;
    if (u.guarding) s.statusMark(u.uid, "guard");
    if (u.curse?.kind === "stun") s.statusMark(u.uid, "stun");
    if (u.curse?.kind === "confuse") s.statusMark(u.uid, "confuse");
    if (u.loafing) s.statusMark(u.uid, "sleep");
  }
}
(() => {
  const P = e2.prototype, upd = P.update;
  P.update = function (dt) {
    this.marksUpdate();
    upd.call(this, dt);
  };
})();
