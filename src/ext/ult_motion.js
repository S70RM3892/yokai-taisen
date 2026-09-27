// ============================================================================
// 奥義のモーション（全員）。
// 16 種の振り付けを、ひっさつわざの名前・種類（単体・全体・弱体・回復・呪い）・属性・その妖怪の動きの癖で選び（ult_style.js）、
// ため（出だし）・きめ（しめ）・属性の当たり方・回数・高さ・回転を 1 体ずつ変える（全員ちがう組み合わせ）。
//   meteor 跳んで叩きつける / rush 踏み込んで連撃 / drill 回転して突き抜ける / beam 浮いて光線
//   rain 天から降らせる / quake 地面を踏み鳴らす / tornado 竜巻で薙ぎ払う / phantom 消えて斬る
//   bloom 味方に光を降らせる / stretch 伸びてしなる / barrage 弾を連射 / pillar 足もとから火柱
//   thunder 雷を落とす / orbit まわりを回って打つ / summon 大きくなって押しつぶす / clone 分身で囲んで斬る
// ダメージは奥義が出てから約 0.6 秒後に出るので、当たる瞬間をそこに合わせてある。
// ============================================================================

// 振り付けの選び方・1 体ずつの揺らぎは ult_style.js（ultScript）

var clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
var segK = (k, a, b) => clamp01((k - a) / (b - a));
var easeOutK = x => 1 - (1 - x) * (1 - x);
var easeInK = x => x * x;

Object.assign(e2.prototype, {
  // 奥義を始める。target は単体の相手（なければ前衛のまん中）
  startUlt(uid, targetUid, grand, color) {
    const f = this.figs.get(uid);
    if (!f || !f.def) return !1;
    const sc = ultScript(f.def), style = sc.style, v = sc.v, power = grand ? 1.35 : 1;
    const pal = sc.cut.colors.map(x => parseInt(x.slice(1), 16));
    if (!grand) color = pal[0];
    const foes = [...this.figs.values()].filter(o => o.ally !== f.ally && o.root.visible && o.alive);
    const mates = [...this.figs.values()].filter(o => o.ally === f.ally && o.root.visible && o.alive);
    const tf = (targetUid !== null && this.figs.get(targetUid)) || foes[1] || foes[0] || null;
    const home = f.home.clone();
    const T = tf ? tf.home.clone() : home.clone().add(new D(0, 0, f.ally ? -4.6 : 4.6));
    const dir = T.clone().sub(home).setY(0).normalize();
    const center = foes.length ? foes.reduce((s, o) => s.add(o.home), new D()).multiplyScalar(1 / foes.length) : T.clone();
    const matesC = mates.length ? mates.reduce((s, o) => s.add(o.home), new D()).multiplyScalar(1 / mates.length) : home.clone();
    f.baseYaw ??= f.model.rotation.y;
    f.anim = {
      kind: "ultx", style, v, power, color, color2: pal[1], fx: sc.fx, windup: sc.windup, finish: sc.finish, t: 0, all: ["all", "curseAll"].includes(f.def.ult?.kind), dur: (["rain", "beam", "bloom", "tornado", "barrage", "thunder", "summon"].includes(style) ? 2 : 1.8) * (grand ? 1.1 : 1),
      home, T, dir, center, matesC, foes: foes.map(o => o.home.clone()), mates: mates.map(o => o.home.clone()), fired: new Set(), trail: 0,
    };
    return !0;
  },

  // 当たる瞬間の共通演出
  ultImpact(p, color, big = 1, fx = null) {
    const P = p.clone().setY(0);
    if (fx) this.elemBurst(P, fx, big);
    this.shockwave(P, color, 2.6 * big, 0.55);
    this.shockwave(P, 0xffffff, 1.5 * big, 0.4, 0.3);
    this.flare(P.clone().setY(1), color, 3 * big, 0.3);
    this.sparkle(P.clone().setY(0.9), color, Math.round(20 * big), 3.8, 0.3, 1);
    this.camShake = Math.max(this.camShake, 0.35 * big);
    this.hitStop = Math.max(this.hitStop, 0.14 + 0.06 * big);
  },

  // 毎フレーム：振り付けの姿勢を決める
  ultPose(f, a, k, dt) {
    const o = { pos: a.home.clone(), y: 0, rx: 0, rz: 0, face: null, spin: 0, sx: 1, sy: 1, op: 1 };
    const once = (key, at, fn) => { if (k >= at && !a.fired.has(key)) { a.fired.add(key); fn(); } };
    const facing = to => Math.atan2(to.x - o.pos.x, to.z - o.pos.z);
    const P = a.power, c = a.color, c2 = a.color2, T = a.T, H = a.home, v = a.v;
    const hit = (p, big) => this.ultImpact(p, c, big, a.fx);
    const trail = (col, size = 1) => {
      a.trail -= dt;
      if (a.trail > 0) return;
      a.trail = 0.035;
      this.flare(o.pos.clone().setY(o.y + 0.9), col, 1.2 * size, 0.3);
    };
    switch (a.style) {
      case "meteor": {
        const crouch = Math.sin(segK(k, 0, 0.12) * Math.PI);
        o.sy = 1 - crouch * 0.3, o.sx = 1 + crouch * 0.15;
        const u = segK(k, 0.12, 0.33);
        if (u > 0 && k < 0.55) {
          const land = T.clone().sub(a.dir.clone().multiplyScalar(0.9));
          o.pos.lerpVectors(H, land, easeOutK(u));
          o.y = v.height * P * Math.sin(u * Math.PI) * (u < 1 ? 1 : 0);
          o.rx = -u * Math.PI * 2 * v.spins;
          o.face = facing(T);
          if (u < 1) trail(c, 0.8);
        }
        once("hit", 0.33, () => hit(T, 1.3 * P));
        const sq = Math.sin(segK(k, 0.33, 0.45) * Math.PI);
        if (k >= 0.33 && k < 0.55) o.pos.copy(T.clone().sub(a.dir.clone().multiplyScalar(0.9))), o.sy = 1 - sq * 0.35, o.sx = 1 + sq * 0.2, o.face = facing(T);
        const b = segK(k, 0.55, 0.85);
        if (k >= 0.55) o.pos.lerpVectors(T.clone().sub(a.dir.clone().multiplyScalar(0.9)), H, easeOutK(b)), o.y = Math.sin(b * Math.PI) * 1.2;
        break;
      }
      case "rush": {
        // 全体わざなら 1 発ごとに となりの相手へ移って打つ
        const tg = a.all && a.foes.length ? a.foes : [T], n = Math.round(v.hits * (P > 1 ? 1.5 : 1));
        const frontOf = t => t.clone().sub(a.dir.clone().multiplyScalar(1.1)), tAt = j => tg[j % tg.length];
        o.rx = -Math.sin(segK(k, 0, 0.1) * Math.PI) * 0.3;
        const u = segK(k, 0.1, 0.2);
        if (k < 0.2) { o.pos.lerpVectors(H, frontOf(tAt(0)), easeInK(u)); if (u > 0) trail(c, 0.9); o.face = facing(tAt(0)); }
        if (k >= 0.2 && k < 0.64) {
          const hk = Math.min(n - 1e-6, segK(k, 0.2, 0.64) * n), i = Math.floor(hk), frac = hk - i, Ti = tAt(i);
          const side = (i % 2 ? 1 : -1) * v.side, lat = new D(-a.dir.z, 0, a.dir.x).multiplyScalar(0.75 * side);
          const from = i > 0 && tAt(i - 1) !== Ti ? frontOf(tAt(i - 1)).lerp(frontOf(Ti), Math.min(1, frac * 3)) : frontOf(Ti);
          o.pos.copy(from).add(lat.multiplyScalar(Math.sin(frac * Math.PI))).add(a.dir.clone().multiplyScalar(0.45 * Math.sin(frac * Math.PI)));
          o.rz = side * 0.5 * Math.sin(frac * Math.PI), o.y = 0.3 * Math.sin(frac * Math.PI);
          o.face = facing(Ti);
        }
        for (let j = 0; j < n; j++) once("h" + j, 0.2 + (j + 0.5) / n * 0.44, () => {
          const t = tAt(j), p = t.clone().setY(1);
          this.slash(p, j === n - 1 ? 0xffffff : j % 2 ? c2 : c, 1.3 + j * 0.15);
          this.sparkle(p, c, 10, 3, 0.25);
          this.camShake = Math.max(this.camShake, 0.18);
          this.hitStop = Math.max(this.hitStop, j === n - 1 ? 0.2 : 0.07);
          if (j >= n - tg.length) hit(t, P);
        });
        const b = segK(k, 0.64, 0.86), last = frontOf(tAt(n - 1));
        if (k >= 0.64) o.pos.lerpVectors(last, H, easeOutK(b)), o.y = Math.sin(b * Math.PI) * 1.4, o.rx = b < 1 ? -b * Math.PI * 2 : 0;
        break;
      }
      case "drill": {
        const r = segK(k, 0, 0.18), u = segK(k, 0.18, 0.38), through = T.clone().add(a.dir.clone().multiplyScalar(1.6));
        o.y = 0.8 * r, o.rx = 1.25 * r, o.face = facing(T);
        o.rz = k < 0.45 ? k * Math.PI * 16 * P : 0;
        if (k >= 0.18 && k < 0.45) { o.pos.lerpVectors(H, through, easeInK(u)); trail(c, 1.1); }
        once("hit", 0.31, () => hit(T, 1.2 * P));
        if (k >= 0.45 && k < 0.7) o.pos.copy(through), o.y = 0.8, o.rx = 1.25 * (1 - segK(k, 0.45, 0.6)), o.face = facing(H);
        const b = segK(k, 0.7, 0.92);
        if (k >= 0.7) o.pos.lerpVectors(through, H, easeOutK(b)), o.y = 0.8 * (1 - b) + Math.sin(b * Math.PI) * 0.8, o.face = b < 1 ? facing(H) : null;
        break;
      }
      case "beam": {
        const up = segK(k, 0, 0.22), down = segK(k, 0.7, 0.92);
        o.y = 1.3 * easeOutK(up) * (1 - down), o.face = facing(a.T);
        const chest = () => o.pos.clone().setY(o.y + 1.1).add(a.dir.clone().multiplyScalar(0.5));
        if (k < 0.3) { a.trail -= dt; if (a.trail <= 0) { a.trail = 0.05; this.flare(chest(), c, 0.8 + up * 1.8 * P, 0.2); } }
        once("fire", 0.3, () => {
          for (const t of a.all && a.foes.length ? a.foes : [T]) this.beam(chest(), t.clone().setY(1), c, 0.35 * P);
          hit(T, P);
          this.flashLevel = Math.max(this.flashLevel, 0.35);
        });
        if (k >= 0.3 && k < 0.45) o.rx = -0.35 * Math.sin(segK(k, 0.3, 0.45) * Math.PI);
        break;
      }
      case "rain": {
        const up = segK(k, 0, 0.2), down = segK(k, 0.72, 0.92);
        o.y = 1.1 * easeOutK(up) * (1 - down), o.spin = k * Math.PI * 2;
        o.sy = 1 + Math.sin(segK(k, 0.1, 0.3) * Math.PI) * 0.18;
        const targets = a.foes.length ? a.foes : [T];
        targets.forEach((t, i) => {
          const at = 0.18 + i * 0.07;
          once("drop" + i, at, () => this.fallingOrb(t, c, 0.33, P, a.fx));
        });
        break;
      }
      case "quake": {
        const beats = [0.1, 0.22, 0.34], hs = [0.5, 0.5, 1.3 * P];
        for (let i = 0; i < 3; i++) {
          const s = segK(k, beats[i] - 0.08, beats[i]);
          if (k >= beats[i] - 0.08 && k < beats[i]) o.y = hs[i] * Math.sin(s * Math.PI), o.sy = 1 + 0.15 * Math.sin(s * Math.PI);
          once("st" + i, beats[i], () => {
            this.shockwave(H, c, i === 2 ? 3.4 : 1.6, 0.5);
            this.camShake = Math.max(this.camShake, i === 2 ? 0.55 : 0.2);
            this.hitStop = Math.max(this.hitStop, i === 2 ? 0.18 : 0.05);
            // 地面を走る波が相手へ
            const tg = a.foes.length ? a.foes : [T];
            for (const t of tg) {
              const mid = H.clone().lerp(t, 0.5);
              setTimeout(() => this.shockwave(mid, c, 1.2, 0.35), 60);
              if (i === 2) setTimeout(() => hit(t, P), 130);
            }
          });
        }
        const land = Math.sin(segK(k, 0.34, 0.46) * Math.PI);
        o.sy = k >= 0.34 && k < 0.46 ? 1 - land * 0.3 : o.sy, o.sx = k >= 0.34 && k < 0.46 ? 1 + land * 0.2 : o.sx;
        o.face = facing(a.center);
        break;
      }
      case "tornado": {
        o.spin = easeInK(segK(k, 0, 0.8)) * Math.PI * 12 * P;
        o.y = 0.4 * Math.sin(segK(k, 0, 0.9) * Math.PI);
        const pts = a.foes.length ? a.foes : [T], go = segK(k, 0.18, 0.3), sweep = segK(k, 0.3, 0.6), back = segK(k, 0.66, 0.9);
        const first = pts[0].clone().sub(a.dir.clone().multiplyScalar(0.8)), last = pts[pts.length - 1].clone().sub(a.dir.clone().multiplyScalar(0.8));
        if (k < 0.3) o.pos.lerpVectors(H, first, easeOutK(go));
        else if (k < 0.66) o.pos.lerpVectors(first, last, sweep);
        else o.pos.lerpVectors(last, H, easeOutK(back));
        this.tornadoAt(f, o.pos, c, k < 0.85 ? 1 - back : 0, P);
        pts.forEach((t, i) => once("tw" + i, 0.32 + i * 0.09, () => hit(t, 0.8 * P)));
        break;
      }
      case "phantom": {
        const pts = a.all && a.foes.length ? a.foes.slice(0, 3) : [T, T, T];
        once("vanish", 0.02, () => { this.flare(H.clone().setY(1), 0x7a3ae0, 2.4, 0.4); this.sparkle(H.clone().setY(1), 0x3a1a60, 14, 2, 0.4, 0.6); });
        o.op = 1 - segK(k, 0, 0.1);
        const win = 0.4 / pts.length;
        pts.forEach((t, i) => {
          const a0 = 0.14 + i * win, a1 = a0 + win;
          if (k >= a0 && k < a1) {
            const s = segK(k, a0, a1), side = (i % 2 ? 1 : -1) * v.side;
            o.pos.copy(t).add(new D(side * 0.9, 0, 0)).add(a.dir.clone().multiplyScalar(0.3 - s * 0.6));
            o.op = Math.sin(s * Math.PI), o.face = facing(t), o.rz = side * 0.3;
          }
          once("ph" + i, a0 + win * 0.5, () => {
            const p = t.clone().setY(1);
            this.slash(p, 0xb07ce0, 1.6), this.slash(p, 0xffffff, 1.1);
            this.flare(p, 0x7a3ae0, 2.4, 0.3);
            this.hitStop = Math.max(this.hitStop, 0.12);
            this.camShake = Math.max(this.camShake, 0.25);
            if (i === pts.length - 1) hit(t, P);
          });
        });
        if (k >= 0.54 + 0.02 && k < 0.8) o.op = 0;
        if (k >= 0.8) o.op = segK(k, 0.8, 0.92);
        once("back", 0.8, () => this.flare(H.clone().setY(1), 0x7a3ae0, 2.2, 0.35));
        break;
      }
      case "bloom": {
        const up = segK(k, 0, 0.25), down = segK(k, 0.72, 0.95);
        o.y = 0.9 * easeOutK(up) * (1 - down), o.spin = segK(k, 0, 0.7) * Math.PI * 2 * v.spins;
        o.sy = o.sx = 1 + Math.sin(segK(k, 0.2, 0.45) * Math.PI) * 0.22;
        once("ring", 0.22, () => { this.shockwave(a.matesC, 0xf2d15c, 4.5 * P, 0.9); this.shockwave(a.matesC, 0x7fd46b, 3, 0.7, 0.2); this.flare(H.clone().setY(1.6), 0xfff2a0, 4, 0.45); });
        a.mates.forEach((m, i) => once("hl" + i, 0.3 + i * 0.05, () => { this.pillar(m, 0xd8ffc8, 4, 0.55, 0.9); this.sparkle(m.clone().setY(0.3), 0xf2d15c, 14, 1.6, 0.22, 1.4, 1); }));
        break;
      }
      case "stretch": {
        const s = segK(k, 0, 0.22);
        o.sy = 1 + 1.2 * easeOutK(s) * (1 - segK(k, 0.55, 0.75)), o.sx = 1 - 0.25 * easeOutK(s) * (1 - segK(k, 0.55, 0.75));
        o.face = facing(T);
        const w1 = Math.sin(segK(k, 0.22, 0.34) * Math.PI), w2 = Math.sin(segK(k, 0.36, 0.5) * Math.PI);
        o.rx = 1.3 * (w1 + w2);
        o.pos.lerpVectors(H, T, 0.35 * Math.max(w1, w2));
        once("w1", 0.31, () => { this.slash(T.clone().setY(1.1), c, 1.8); hit(T, 0.8 * P); });
        once("w2", 0.45, () => { this.slash(T.clone().setY(0.8), 0xffffff, 1.5); hit(T, P); });
        break;
      }
      case "barrage": {
        // 浮いて、弾を続けて撃つ（全体わざなら相手の前衛に順に）
        const tg = a.all && a.foes.length ? a.foes : [T], n = a.all ? Math.max(tg.length * 2, v.hits + 1) : v.hits + 1;
        const up = segK(k, 0, 0.14), down = segK(k, 0.7, 0.9);
        o.y = 0.7 * easeOutK(up) * (1 - down), o.face = facing(a.all ? a.center : T);
        const chest = () => o.pos.clone().setY(o.y + 1).add(a.dir.clone().multiplyScalar(0.5));
        for (let j = 0; j < n; j++) {
          const at = 0.12 + j * (0.2 / n), t = tg[j % tg.length];
          once("b" + j, at, () => {
            o.rx = -0.2;
            this.bolt(chest(), t.clone().setY(1), j % 2 ? c2 : c, 0.13, () => {
              this.sparkle(t.clone().setY(1), c, 8, 2.6, 0.24);
              this.camShake = Math.max(this.camShake, 0.12);
              if (j >= n - tg.length) hit(t, P);
            });
          });
        }
        if (k >= 0.12 && k < 0.34) o.rx = -0.25 * Math.abs(Math.sin(k * 90)), o.sx = 1 + 0.06 * Math.abs(Math.sin(k * 90));
        break;
      }
      case "pillar": {
        // 力をためて、相手の足もとから柱を噴き上げる
        const tg = a.all && a.foes.length ? a.foes : [T];
        const g = Math.sin(segK(k, 0, 0.3) * Math.PI * 0.5), rel = segK(k, 0.3, 0.5);
        o.sy = 1 + 0.35 * g * (1 - rel), o.sx = 1 - 0.1 * g * (1 - rel), o.face = facing(a.all ? a.center : T);
        o.rx = -0.3 * g * (1 - rel);
        once("mark", 0.1, () => tg.forEach(t => this.shockwave(t, c2, 1.2, 0.5)));
        tg.forEach((t, i) => once("p" + i, 0.3 + i * 0.02, () => {
          this.pillar(t, c, 7 * P, 0.9 * P, 0.9), this.pillar(t, 0xffffff, 7 * P, 0.4, 0.7);
          this.sparkle(t.clone().setY(0.4), c2, 18, 4.5, 0.3, 2.2, 0.9);
          hit(t, P);
        }));
        break;
      }
      case "thunder": {
        // 腕を上げて空を呼び、雷を落とす
        const tg = a.all && a.foes.length ? a.foes : [T];
        const up = segK(k, 0, 0.26), down = segK(k, 0.72, 0.92);
        o.y = 0.6 * easeOutK(up) * (1 - down), o.sy = 1 + 0.25 * Math.sin(up * Math.PI * 0.5) * (1 - down), o.face = facing(a.all ? a.center : T);
        once("cloud", 0.08, () => tg.forEach(t => this.flare(t.clone().setY(7), 0x303048, 4, 0.5)));
        once("pre", 0.2, () => tg.forEach(t => this.beam(t.clone().setY(8), t.clone().setY(0.1), c2, 0.05)));
        tg.forEach((t, i) => once("z" + i, 0.3 + i * 0.03, () => {
          this.beam(t.clone().setY(9), t.clone().setY(0.1), 0xffffff, 0.3 * P), this.beam(t.clone().setY(9), t.clone().setY(0.1), c2, 0.5 * P);
          this.flashLevel = Math.max(this.flashLevel, 0.45);
          hit(t, 1.1 * P);
        }));
        break;
      }
      case "orbit": {
        // 相手のまわりを回りながら打つ
        const tg = a.all && a.foes.length ? a.foes : [T], n = v.hits, R = 1.3;
        const go = segK(k, 0.08, 0.18), ring = segK(k, 0.18, 0.62), back = segK(k, 0.66, 0.88);
        const ctr = a.all ? a.center : T, start = ctr.clone().sub(a.dir.clone().multiplyScalar(R));
        if (k < 0.18) o.pos.lerpVectors(H, start, easeInK(go)), o.face = facing(ctr), go > 0 && trail(c, 0.8);
        else if (k < 0.66) {
          const ang = Math.atan2(-a.dir.x, -a.dir.z) + v.side * ring * Math.PI * 2 * v.spins, r = a.all ? R + 1.6 : R;
          o.pos.set(ctr.x + Math.sin(ang) * r, 0, ctr.z + Math.cos(ang) * r), o.y = 0.25 + 0.2 * Math.sin(ring * Math.PI * 6);
          o.face = facing(ctr), o.rz = -v.side * 0.35, trail(c2, 0.7);
        } else o.pos.lerpVectors(start, H, easeOutK(back)), o.y = Math.sin(back * Math.PI) * 1.1, o.spin = back * Math.PI * 2;
        for (let j = 0; j < n; j++) once("o" + j, 0.2 + (j + 0.5) / n * 0.42, () => {
          const t = tg[j % tg.length], p = t.clone().setY(1);
          this.slash(p, j % 2 ? c2 : c, 1.4), this.sparkle(p, c, 8, 2.8, 0.24);
          this.hitStop = Math.max(this.hitStop, 0.06), this.camShake = Math.max(this.camShake, 0.15);
          if (j >= n - tg.length) hit(t, P);
        });
        break;
      }
      case "summon": {
        // 大きくなって、上から押しつぶす
        const g = easeOutK(segK(k, 0, 0.22)), fall = segK(k, 0.22, 0.32), sh = segK(k, 0.55, 0.85);
        const big = 1 + 1.4 * g * (1 - sh), land = H.clone().lerp(a.all ? a.center : T, 0.55);
        o.sx = o.sy = big, o.face = facing(a.all ? a.center : T);
        if (k < 0.22) o.y = 1.6 * g;
        else if (k < 0.55) o.pos.lerpVectors(H, land, easeInK(fall)), o.y = 1.6 * (1 - easeInK(fall)), o.sy = big * (1 - 0.25 * Math.sin(segK(k, 0.32, 0.45) * Math.PI));
        else o.pos.lerpVectors(land, H, easeOutK(sh));
        once("shadow", 0.12, () => this.shockwave(land, 0x000000, 3 * P, 0.4));
        once("slam", 0.32, () => {
          this.shockwave(land, c, 5 * P, 0.7), this.shockwave(land, 0xffffff, 3 * P, 0.5);
          this.camShake = Math.max(this.camShake, 0.7), this.hitStop = Math.max(this.hitStop, 0.2);
          for (const t of a.all && a.foes.length ? a.foes : [T]) hit(t, 1.2 * P);
        });
        break;
      }
      case "clone": {
        // 3 つの影に分かれて囲み、同時に斬る
        const tg = a.all && a.foes.length ? a.foes : [T], ctr = a.all ? a.center : T;
        const pos3 = [0, 1, 2].map(i => { const ang = Math.atan2(-a.dir.x, -a.dir.z) + (i - 1) * 1.1 * v.side; return new D(ctr.x + Math.sin(ang) * 1.5, 0, ctr.z + Math.cos(ang) * 1.5); });
        once("split", 0.06, () => { this.flare(H.clone().setY(1), c2, 2.4, 0.35); pos3.forEach(p => this.flare(p.clone().setY(1), c, 1.8, 0.4)); });
        const hop = segK(k, 0.06, 0.4), cur = Math.min(2, Math.floor(hop * 3));
        if (k < 0.06) o.op = 1 - k / 0.06;
        else if (k < 0.4) {
          const pp = pos3[cur]; o.pos.copy(pp), o.op = 0.35 + 0.65 * Math.abs(Math.sin(hop * Math.PI * 3)), o.face = facing(ctr), o.rz = 0.3 * v.side;
          a.trail -= dt; if (a.trail <= 0) { a.trail = 0.05; pos3.forEach((p, i) => i !== cur && this.flare(p.clone().setY(1), c, 1.1, 0.12)); }
        } else if (k < 0.7) o.op = 0;
        else o.op = segK(k, 0.7, 0.85);
        pos3.forEach((p, i) => once("cs" + i, 0.2 + i * 0.05, () => { this.slash(ctr.clone().setY(1), i % 2 ? c2 : 0xffffff, 1.5 + i * 0.2); this.hitStop = Math.max(this.hitStop, 0.08); }));
        once("cx", 0.34, () => tg.forEach(t => { this.slash(t.clone().setY(1), c, 2.2); hit(t, P); }));
        once("back", 0.7, () => this.flare(H.clone().setY(1), c2, 2, 0.3));
        break;
      }
    }
    this.ultFlourish(o, a, k, once);
    return o;
  },

  // ため（出だし）ときめ（しめ）。どの振り付けにも重ねる
  ultFlourish(o, a, k, once) {
    const H = a.home, c = a.color, c2 = a.color2;
    if (k < 0.14) {
      const s = Math.sin(segK(k, 0, 0.14) * Math.PI);
      switch (a.windup) {
        case "crouch": o.sy *= 1 - 0.25 * s, o.sx *= 1 + 0.12 * s; break;
        case "roar": o.sx *= 1 + 0.2 * s, o.sy *= 1 + 0.2 * s; once("wu", 0.06, () => { this.shockwave(H, c2, 2.2, 0.4); this.camShake = Math.max(this.camShake, 0.2); }); break;
        case "spinup": o.spin += segK(k, 0, 0.14) * Math.PI * 2; break;
        case "glint": once("wu", 0.05, () => { this.flare(H.clone().setY(1.7), 0xffffff, 1.4, 0.3); this.flare(H.clone().setY(1.7), c2, 0.9, 0.4); }); break;
        case "aura": once("wu", 0.01, () => this.sparkle(H.clone().setY(0.1), c2, 16, 1.2, 0.26, 3, 0.9)); break;
        case "rise": o.y += 0.5 * s; break;
        case "tremble": o.rz += Math.sin(k * 160) * 0.14 * s, o.pos.x += Math.sin(k * 210) * 0.05 * s; break;
        case "flash": once("wu", 0.04, () => { this.flashLevel = Math.max(this.flashLevel, 0.3); this.flare(H.clone().setY(1), c, 3, 0.25); }); break;
      }
    }
    if (k > 0.86) {
      const u = segK(k, 0.86, 1), s = Math.sin(u * Math.PI);
      switch (a.finish) {
        case "pose": o.sx *= 1 + 0.16 * s, o.sy *= 1 + 0.16 * s; once("fi", 0.9, () => this.sparkle(H.clone().setY(1.2), c2, 10, 2, 0.22, 1)); break;
        case "flip": o.rx += -Math.PI * 2 * easeOutK(u), o.y += 0.8 * s; break;
        case "twirl": o.spin += Math.PI * 2 * easeOutK(u); break;
        case "bow": o.rx += 0.5 * s; break;
        case "stomp": o.sy *= 1 - 0.18 * s; once("fi", 0.93, () => this.shockwave(H, c, 1.8, 0.4)); break;
        case "glow": once("fi", 0.9, () => this.flare(H.clone().setY(1.1), c2, 3, 0.4)); break;
        case "hop": o.y += 0.6 * Math.abs(Math.sin(u * Math.PI * 2)); break;
        case "vanish": o.op *= 1 - s; once("fi", 0.92, () => this.flare(H.clone().setY(1), c, 1.8, 0.3)); break;
      }
    }
  },

  // 属性ごとの当たり方
  elemBurst(P, fx, big = 1) {
    const at = y => P.clone().setY(y);
    switch (fx) {
      case "fire": this.pillar(P, 0xff7a2a, 3 * big, 0.5, 0.5); this.sparkle(at(0.4), 0xffb347, 14, 3, 0.28, 2.4); break;
      case "water": this.shockwave(P, 0x5fd0e9, 2.4 * big, 0.55); setTimeout(() => this.shockwave(P, 0xe3f8ff, 1.4 * big, 0.4), 90); this.sparkle(at(0.6), 0x9fe6ff, 14, 2.6, 0.24, 1.6); break;
      case "thunder": this.beam(at(8), at(0.1), 0xfff07a, 0.16 * big); this.flashLevel = Math.max(this.flashLevel, 0.25); break;
      case "earth": this.shockwave(P, 0xa06a3a, 3 * big, 0.6); this.sparkle(at(0.3), 0x8a5a2b, 14, 3.2, 0.3, 1.2); this.camShake = Math.max(this.camShake, 0.4 * big); break;
      case "ice": this.sparkle(at(0.8), 0xe3f8ff, 20, 2.4, 0.22, 1.8); this.flare(at(1), 0xffffff, 2.2 * big, 0.3); break;
      case "wind": this.slash(at(1.1), 0xb7f0a0, 1.8 * big); this.slash(at(0.7), 0xffffff, 1.4 * big); break;
      case "dark": this.flare(at(1), 0x6a2ab0, 3 * big, 0.45); this.sparkle(at(0.8), 0x3a1a60, 12, 1.6, 0.34, 1); break;
      case "light": this.flare(at(1.2), 0xfff6c8, 3.4 * big, 0.4); this.pillar(P, 0xffffff, 5, 0.3, 0.5); break;
      case "petal": this.sparkle(at(1.2), 0xffc2dc, 22, 1.8, 0.26, 2, 1.1); break;
      case "star": this.sparkle(at(1.2), 0xffe27a, 16, 3.4, 0.3, 2); this.flare(at(1.2), 0xffffff, 1.8 * big, 0.3); break;
    }
  },

  // まっすぐ飛ぶ弾。着いたら onHit
  bolt(from, to, color, dur, onHit) {
    const s = new Rl(new An({ map: this.glow(), color, transparent: !0, depthWrite: !1, blending: hi }));
    let done = !1;
    this.fxAdd(s, dur, k => {
      s.position.lerpVectors(from, to, k);
      s.scale.setScalar(0.8);
      if (Math.random() < 0.5) this.flare(s.position.clone(), color, 0.5, 0.15);
      if (k >= 1 && !done) { done = !0; onHit?.(); }
    });
  },


  // 光線（のびる円柱）
  beam(from, to, color, width) {
    const len = from.distanceTo(to);
    const m = new pt(FX_TUBE, fxMat(color, 0.9)), core = new pt(FX_TUBE, fxMat(0xffffff, 0.9));
    const g = new qr();
    g.add(m, core);
    g.position.copy(from).lerp(to, 0.5);
    g.lookAt(to), g.rotateX(Math.PI / 2);
    this.fxAdd(g, 0.45, k => {
      const w = width * (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85);
      m.scale.set(w, len, w), core.scale.set(w * 0.4, len, w * 0.4);
      m.material.opacity = 0.8 * (1 - k), core.material.opacity = 1 - k;
    });
    // fxAdd は obj.material を捨てるので、中の 2 つは自分で捨てる
    setTimeout(() => { m.material.dispose(); core.material.dispose(); }, 600);
  },

  // 天から落ちる光の玉。着いたら属性ごとの弾け方
  fallingOrb(to, color, dur, power, fx = null) {
    const s = new Rl(new An({ map: this.glow(), color, transparent: !0, depthWrite: !1, blending: hi }));
    const from = to.clone().add(new D((Math.random() - 0.5) * 1.5, 7, 0));
    this.fxAdd(s, dur, k => {
      s.position.lerpVectors(from, to.clone().setY(0.5), easeInK(k));
      s.scale.setScalar(1.1 * power);
      if (Math.random() < 0.6) this.flare(s.position.clone(), color, 0.7, 0.2);
      if (k >= 1) { this.ultImpact(to, color, 0.9 * power, fx); this.pillar(to, color, 3.5, 0.35, 0.5); }
    });
  },

  // 竜巻（回る筒を 2 重に）
  tornadoAt(f, pos, color, w, power) {
    if (!f.tornado) {
      const a = new pt(FX_TUBE, fxMat(color, 0.35)), b = new pt(FX_TUBE, fxMat(0xffffff, 0.25));
      f.tornado = new qr();
      f.tornado.add(a, b);
      this.scene.add(f.tornado);
    }
    const [a, b] = f.tornado.children;
    f.tornado.position.set(pos.x, 1.4 * power, pos.z);
    a.scale.set(0.9 * w * power, 2.8 * power, 0.9 * w * power), b.scale.set(0.55 * w * power, 3.2 * power, 0.55 * w * power);
    f.tornado.rotation.y += 0.4;
    a.material.opacity = 0.35 * w, b.material.opacity = 0.25 * w;
    if (w <= 0.01) { this.scene.remove(f.tornado); a.material.dispose(); b.material.dispose(); f.tornado = null; }
  },
});

// addFigure で def を覚え、updateFigure で奥義の姿勢を当てる
(() => {
  const P = e2.prototype, add = P.addFigure, upd = P.updateFigure;
  P.addFigure = function (e, t, a, r, i, def) {
    add.call(this, e, t, a, r, i, def);
    const f = this.figs.get(e);
    if (f) f.def = def;
  };
  P.updateFigure = function (f, dt) {
    const a = f.anim;
    if (!a || a.kind !== "ultx") return upd.call(this, f, dt);
    if (!f.root.visible) return;
    a.t += dt / MOTION_SLOW; // 対戦の速さ（エンジンのモーションの長さと同じ倍率でゆっくり）
    const k = Math.min(1, a.t / a.dur), o = this.ultPose(f, a, k, dt), m = f.model;
    f.root.position.copy(o.pos);
    m.position.y = o.y;
    m.rotation.set(o.rx, (o.face ?? f.baseYaw) + o.spin, o.rz);
    m.scale.set(o.sx, o.sy, o.sx);
    f.flash = Math.max(0, f.flash - dt * 4);
    setModelLook(m, f.flash, o.op);
    animateModel(m, this.clock + f.phase);
    f.shadow.material.opacity = 0.35 * o.op - Math.min(0.2, o.y * 0.1);
    if (k >= 1) {
      f.anim = null;
      m.rotation.set(0, f.baseYaw, 0), m.scale.set(1, 1, 1), m.position.y = 0;
      if (f.tornado) this.tornadoAt(f, o.pos, a.color, 0, 1);
    }
  };
})();
