// ============================================================================
// 超高精細モデルの道具（黒鬼・流行りの型の妖怪など、手で作りこむ妖怪に使う）。
// three.js の基本形ではなく、曲面を 1 から作る：回転体（胴・手足）と曲がった管（角・髪・指・しっぽ）。
// 形は毎回同じなので、ジオメトリは名前をつけて 1 度だけ作り、使い回す（hiGeo）。
// 腕は humanoid と同じつなぎ方（肩のグループを k.arms に入れる。1 本目 = 左、2 本目 = 右で武器を持つ）なので、
// 行動のモーションはそのまま効く。
// ============================================================================

// 頂点と三角形をためて 1 つのジオメトリにする
class KMesher {
  constructor() { this.pos = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  // rows × cols の格子（cols 方向は輪になる）。f(i, j) → [x, y, z]
  grid(rows, cols, f, xf, wrap = true) {
    const b = this.n;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const p = f(i, j);
      const q = xf ? xf(p) : p;
      this.pos.push(q[0], q[1], q[2]);
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols - (wrap ? 0 : 1); j++) {
      const a = b + i * cols + j, c = b + i * cols + (j + 1) % cols, d = a + cols, e = c + cols;
      this.idx.push(a, c, d, c, e, d);
    }
    return this;
  }
  // 回転体。prof = [[半径, 高さ], …]（下から上）。sx・sz で断面をつぶす
  lathe(prof, seg = 40, xf, sx = 1, sz = 1) {
    if (prof[0][1] > prof[prof.length - 1][1]) prof = [...prof].reverse(); // 上から書いた断面も、面は外向きにそろえる
    return this.grid(prof.length, seg, (i, j) => {
      const a = -j / seg * Math.PI * 2, [r, y] = prof[i];
      return [Math.cos(a) * r * sx, y, Math.sin(a) * r * sz];
    }, xf);
  }
  // 回転体の一部（角度 a0 → a1 だけ。+z が正面 = π/2）。うすい布（半分だけの着物・垂れ布）に使う
  latheArc(prof, a0, a1, seg = 24, xf, sx = 1, sz = 1) {
    if (prof[0][1] > prof[prof.length - 1][1]) prof = [...prof].reverse();
    return this.grid(prof.length, seg + 1, (i, j) => {
      const a = a1 - (a1 - a0) * j / seg, [r, y] = prof[i];
      return [Math.cos(a) * r * sx, y, Math.sin(a) * r * sz];
    }, xf, false);
  }
  // 球（楕円体）。rows・cols で細かさ
  ball(rows = 20, cols = 30, xf) {
    return this.grid(rows + 1, cols, (i, j) => { const v = i / rows * Math.PI, a = -j / cols * Math.PI * 2; return [Math.sin(v) * Math.cos(a), -Math.cos(v), Math.sin(v) * Math.sin(a)]; }, xf);
  }
  // 上半分の球（かぶと・帽子）。y = 0 のふちは開いている
  dome(rows = 12, cols = 32, xf) {
    return this.grid(rows + 1, cols, (i, j) => { const v = Math.PI / 2 + i / rows * Math.PI / 2, a = -j / cols * Math.PI * 2; return [Math.sin(v) * Math.cos(a), -Math.cos(v), Math.sin(v) * Math.sin(a)]; }, xf);
  }
  // 曲がった管。cf(t) → 中心、rf(t) → 太さ（数でも関数でもよい）。両はしは閉じる
  tube(cf, rf, n = 24, radial = 10, xf, flat = 1) {
    const R = typeof rf === "number" ? () => rf : rf;
    const P = [], T = [];
    for (let i = 0; i <= n; i++) P.push(cf(i / n));
    for (let i = 0; i <= n; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(n, i + 1)];
      T.push(kNorm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]));
    }
    // 平行移動で断面の向きを運ぶ（ねじれない）
    let N = kNorm(kCross(T[0], Math.abs(T[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    const F = [];
    for (let i = 0; i <= n; i++) {
      if (i) { const B = kCross(T[i], N); N = kNorm(kCross(B, T[i])); }
      F.push([N, kCross(T[i], N)]);
    }
    const rows = n + 3;
    return this.grid(rows, radial, (i, j) => {
      const k = Math.min(n, Math.max(0, i - 1)), r = i === 0 || i === rows - 1 ? 0 : R(k / n);
      const a = j / radial * Math.PI * 2, [nn, bb] = F[k], p = P[k];
      const c = Math.cos(a) * r * flat, s = Math.sin(a) * r;
      return [p[0] + nn[0] * c + bb[0] * s, p[1] + nn[1] * c + bb[1] * s, p[2] + nn[2] * c + bb[2] * s];
    }, xf);
  }
  geometry() {
    const g = new pa();
    g.setAttribute("position", new wt(this.pos, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingBox();
    return g;
  }
}
function kNorm(v) { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
function kCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
// 点を回して動かす（x → y → z の順に回す）。s は数か [sx, sy, sz]
function kXf(p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  if (!Array.isArray(r)) r = [0, 0, 0];
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(r[0]), Math.sin(r[0]), Math.cos(r[1]), Math.sin(r[1]), Math.cos(r[2]), Math.sin(r[2])];
  const S = typeof s === "number" ? [s, s, s] : s;
  return q => {
    let [x, y, z] = [q[0] * S[0], q[1] * S[1], q[2] * S[2]];
    [y, z] = [y * cx - z * sx, y * sx + z * cx];
    [x, z] = [x * cy + z * sy, -x * sy + z * cy];
    [x, y] = [x * cz - y * sz, x * sz + y * cz];
    return [x + p[0], y + p[1], z + p[2]];
  };
}
// 輪郭線用：法線の向きに少しふくらませた同じ形
function kInflate(g, d) {
  const o = new pa(), p = g.attributes.position.array, nr = g.attributes.normal.array, a = new Float32Array(p.length);
  for (let i = 0; i < p.length; i++) a[i] = p[i] + nr[i] * d;
  o.setAttribute("position", new wt(a, 3));
  o.setIndex(g.index);
  return o;
}
// 回転体の高さ y での半径（模様を体にはわせる）
function kRadAt(prof, y) {
  for (let i = 1; i < prof.length; i++) {
    const [r0, y0] = prof[i - 1], [r1, y1] = prof[i];
    if ((y - y0) * (y - y1) <= 0 && y1 !== y0) return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return prof[prof.length - 1][0];
}

// 名前つきのジオメトリ置き場（1 度だけ作る）
var HI_GEO = new Map();
function hiGeo(key, f) {
  let g = HI_GEO.get(key);
  if (!g) { const m = new KMesher(); f(m); g = m.geometry(); HI_GEO.set(key, g); }
  return g;
}
function hiOutlineGeo(g, d) {
  const key = g.id + ":" + d;
  let o = HI_GEO.get(key);
  if (!o) HI_GEO.set(key, o = kInflate(g, d));
  return o;
}

// 手足の断面（半径の倍率, 高さ 0 → -1）
var HI_PROF = {
  upper: [[0, 0.03], [0.9, 0], [1.15, -0.12], [1.2, -0.35], [1.08, -0.65], [0.9, -0.9], [0.85, -0.97], [0, -1]],
  fore: [[0, 0.03], [0.85, 0], [1.05, -0.15], [1.08, -0.35], [0.92, -0.7], [0.78, -0.95], [0, -1]],
  thigh: [[0, 0.04], [0.95, 0], [1.1, -0.15], [1.1, -0.45], [0.92, -0.8], [0.78, -0.97], [0, -1]],
  shin: [[0, 0.04], [0.8, 0], [0.95, -0.2], [0.98, -0.38], [0.78, -0.75], [0.62, -0.95], [0, -1]],
  // ズボン・袖（中が空いた筒。外側と内側の 2 枚）
  pants: [[1.25, 0], [1.3, -0.3], [1.25, -0.7], [1.2, -1]],
};

// ModelKit k に高精細の部品を置く道具をかぶせる
function hiKit(k) {
  const H = {
    k,
    ball: hiGeo("ball", m => m.ball(22, 32)),
    ballS: hiGeo("ballS", m => m.ball(10, 14)),
    dome: hiGeo("dome", m => m.dome(12, 32)),
    ring: hiGeo("ring", m => m.tube(t => [Math.cos(t * Math.PI * 2), 0, Math.sin(t * Math.PI * 2)], 0.16, 40, 10)),
    // 置く。p が数（0）なら原点
    P(par, g, c, p, s = 1, r = 0, opt) {
      return k.part(par, g, c, Array.isArray(p) ? p : [0, 0, 0], s, r, opt);
    },
    // 置いて、黒い輪郭線もつける（d は形の単位でのふくらみ）
    O(par, g, c, p, s = 1, r = 0, opt, d) {
      const m = H.P(par, g, c, p, s, r, opt);
      if (d === void 0) { const b = g.boundingBox; d = +(b.max.distanceTo(b.min) * 0.016).toFixed(4); } // 形の大きさに合わせた線の太さ
      const ol = new pt(hiOutlineGeo(g, d), k.mat(0x14101c, { basic: true }));
      ol.material.side = Lt;
      m.add(ol);
      return m;
    },
    // 裏も見える材質（袖・すそ・傘など、うすい布）
    two(par, g, c, p, s, r, opt = {}) {
      const m = H.P(par, g, c, p, s, r, { ...opt, two: 1 });
      m.material.side = 2;
      return m;
    },
    lathe: (key, prof, seg = 40, sx = 1, sz = 1) => hiGeo("L:" + key, m => m.lathe(prof, seg, null, sx, sz)),
    tube: (key, cf, rf, n = 24, radial = 10, flat = 1) => hiGeo("T:" + key, m => m.tube(cf, rf, n, radial, null, flat)),
    // 手足の 1 節（len の長さ、r の太さ）
    seg(kind, len, r, seg = 32) { return hiGeo(`S:${kind}:${len}:${r}`, m => m.lathe(HI_PROF[kind].map(([a, y]) => [a * r, y * len]), seg)); },
    // 中空の筒（ズボン・袖）。prof は [半径, 高さ]
    sleeve(key, prof, seg = 36) {
      return hiGeo("V:" + key, m => { m.lathe(prof, seg); m.lathe(prof.map(([r, y]) => [r * 0.96, y]).reverse(), seg); });
    },
  };
  return H;
}

// だ円体（半径 rx, ry, rz）の表面の点。x, y を決めて z を出す（顔に描く模様）
function hiOnFace(rx, ry, rz, lift = 0.004) {
  return (x, y) => [x, y, rz * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2 - (y / ry) ** 2)) + lift];
}

// 目：白目・黒目（丸／縦長／十字）・光の点・まぶた。左右 1 組を par に置く
// o = { x, y, z, r（大きさ）, ry（左右の向き）, white, iris, irisR, pupil, pupilKind, glow, lid（色）, lidTilt, hl（光の点） }
function hiEyes(H, par, o) {
  const out = [];
  for (const s of [-1, 1]) {
    const g = H.k.group(par, [s * o.x, o.y, o.z], [o.rx ?? 0, s * (o.ry ?? 0.3), 0]);
    const r = o.r, sy = o.sy ?? 1;
    H.P(g, H.ball, o.white ?? 0xffffff, [0, 0, 0], [r, r * sy, r * 0.55], 0, o.glow ? { glow: o.glow } : void 0);
    if (o.iris !== null) {
      const ir = o.irisR ?? 0.62;
      H.P(g, H.ballS, o.iris ?? 0x2a1a10, [0, 0, r * 0.38], [r * ir, r * ir * sy * (o.pupilKind === "slit" ? 1 : 1), r * 0.22], 0, o.irisGlow ? { glow: o.irisGlow } : void 0);
      const pk = o.pupilKind ?? "round", pc = o.pupil ?? 0x0a0608;
      if (pk === "slit") H.P(g, H.ballS, pc, [0, 0, r * 0.5], [r * 0.12, r * ir * 0.9 * sy, r * 0.12]);
      else if (pk === "cross") for (const a of [0.785, -0.785]) H.P(g, H.ballS, pc, [0, 0, r * 0.52], [r * 0.55, r * 0.09, r * 0.08], [0, 0, a]);
      else if (pk !== "none") H.P(g, H.ballS, pc, [0, 0, r * 0.5], [r * ir * 0.55, r * ir * 0.55 * sy, r * 0.12]);
      if (o.hl !== false) H.P(g, H.ballS, 0xffffff, [-r * 0.18, r * 0.22 * sy, r * 0.56], [r * 0.14, r * 0.14, r * 0.06], 0, { glow: 0x606060 });
    }
    if (o.lid !== void 0) H.P(g, H.ball, o.lid, [0, r * (o.lidY ?? 0.55) * sy, r * 0.05], [r * 1.12, r * 0.42 * sy, r * 0.62], [0.25, 0, s * (o.lidTilt ?? 0)]);
    out.push(g);
  }
  return out;
}

// 腕 1 本。side = -1（左）/ 1（右）。
// a = { x, y, tilt, len, r, skin, sleeve（上腕の服の色）, sleeve2（前腕も）, cuff（袖口の形 "bell" で広い袖）, band（手首の輪）,
//       hand: "fist" | "paw" | "open" | "mitt", handColor, claw, fingers }
function hiArm(H, par, side, a) {
  const k = H.k, len = a.len ?? 0.8, r = a.r ?? 0.1, skin = a.skin;
  const sh = k.group(par, [side * a.x, a.y, a.z ?? 0], [a.rx ?? 0, 0, side * (a.tilt ?? 0.25)]);
  const l1 = len * 0.52, l2 = len * 0.48;
  if (a.shoulder !== false) H.O(sh, H.ball, a.sleeve ?? skin, [side * r * 0.2, -r * 0.1, 0], [r * 1.45, r * 1.35, r * 1.35]);
  H.O(sh, H.seg("upper", l1, r), a.sleeve ?? skin, 0, 1, 0, void 0, 0.012);
  H.P(sh, H.ball, a.sleeve2 ?? a.sleeve ?? skin, [0, -l1, 0], [r * 0.95]);
  const el = k.group(sh, [0, -l1, 0], [a.bend ?? 0.12, 0, 0]);
  H.O(el, H.seg("fore", l2, r * 0.92), a.sleeve2 ?? skin, 0, 1, 0, void 0, 0.012);
  if (a.cuff === "bell") {
    // 着物の広い袖：ひじから大きく垂れる布
    H.two(sh, H.sleeve(`bell:${len}:${r}`, [[r * 3.2, -len * 0.62], [r * 2.8, -len * 0.4], [r * 1.9, -len * 0.18], [r * 1.35, 0]]), a.sleeve, [0, 0, -r * 0.4], [1, 1, 0.8]);
  }
  if (a.band) H.P(el, H.ring, a.band, [0, -l2 * 0.86, 0], [r * 0.95, r * 1.6, r * 0.95]);
  const hand = k.group(el, [0, -l2 - r * 0.2, 0]);
  const hc = a.handColor ?? skin;
  const kind = a.hand ?? "fist";
  if (kind === "paw" || kind === "mitt") {
    H.O(hand, H.ball, hc, [0, 0, 0], [r * 1.25, r * 1.15, r * 1.15]);
    if (kind === "paw") for (let f = 0; f < 3; f++) H.P(hand, H.ballS, a.pad ?? shade(hc, -0.08), [(f - 1) * r * 0.55, -r * 0.85, r * 0.45], [r * 0.38, r * 0.3, r * 0.34]);
    if (a.claw) for (let f = 0; f < 3; f++) H.P(hand, H.tube("clawS", t => [0, -t * 0.03, t * 0.02 - t * t * 0.02], t => 0.012 * (1 - t) + 0.001, 8, 6), a.claw, [(f - 1) * r * 0.55, -r * 1.05, r * 0.55], r * 8);
  } else {
    H.O(hand, H.ball, hc, [0, 0, 0], [r * 1.05, r * 1.05, r * 0.88]);
    const fg = H.tube("finger", t => { const u = t * (kind === "open" ? 0.6 : 2.2); return [0, -Math.sin(u) * 0.6, (1 - Math.cos(u)) * 0.36]; }, 0.28, 16, 8);
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * r * 0.45;
      H.P(hand, fg, a.fingerColor ?? hc, [x, -r * 0.4, r * 0.55], r * 0.1 * (f === 0 || f === 3 ? 0.9 : 1));
      if (a.claw) H.P(hand, H.tube("clawF", t => [0, -t * 0.03, t * 0.02 - t * t * 0.02], t => 0.014 * (1 - t) + 0.001, 8, 6), a.claw, [x, -r * 1.0, r * 0.3], r * 7, [Math.PI * 0.9, 0, 0]);
    }
    H.P(hand, fg, a.fingerColor ?? hc, [-side * r * 0.8, r * 0.1, r * 0.4], r * 0.09, [0, 0, -side * 1.2]);
  }
  k.swing(sh, "x", 0.14, 1.4, side > 0 ? 1 : 0);
  (k.arms ??= []).push(sh);
  return { sh, el, hand };
}

// 脚 1 本。a = { x, y（腰の高さ）, len, r, skin, pants（ズボンの色）, foot: "bare" | "claw" | "shoe" | "zori" | "geta" | "boot" | "heel" | "tabi", footColor, strap, claw }
function hiLeg(H, par, side, a) {
  const k = H.k, len = a.len ?? 1, r = a.r ?? 0.14, skin = a.skin;
  const leg = k.group(par, [side * a.x, a.y, 0], [0, 0, side * (a.splay ?? 0.04)]);
  const l1 = len * 0.5, l2 = len * 0.46;
  H.O(leg, H.seg("thigh", l1, r), a.thigh ?? skin, 0, 1, 0, void 0, 0.012);
  const knee = k.group(leg, [0, -l1 + r * 0.1, 0], [0.04, 0, 0]);
  H.P(knee, H.ball, a.thigh ?? skin, [0, 0, r * 0.1], [r * 0.85]);
  H.O(knee, H.seg("shin", l2, r * 0.9), a.shin ?? skin, 0, 1, 0, void 0, 0.012);
  if (a.pants) {
    H.two(leg, H.sleeve(`pants:${l1}:${r}:${a.baggy ?? 1}`, HI_PROF.pants.map(([m, y]) => [m * r * (a.baggy ?? 1), y * l1 * 1.02])), a.pants);
    if (a.longPants !== false) H.two(knee, H.sleeve(`pantsL:${l2}:${r}:${a.baggy ?? 1}`, [[r * 1.18 * (a.baggy ?? 1), 0.02], [r * 1.12 * (a.baggy ?? 1), -l2 * 0.5], [r * (a.cuffR ?? 1.05) * (a.baggy ?? 1), -l2 * (a.pantsEnd ?? 0.92)]]), a.pants);
  }
  const foot = k.group(knee, [0, -l2, 0], [-0.04, side * 0.08, 0]);
  const f = a.foot ?? "bare", fc = a.footColor ?? skin;
  if (f === "bare" || f === "claw") {
    H.O(foot, H.ball, fc, [0, r * 0.3, r * 0.5], [r * 0.95, r * 0.55, r * 1.45]);
    for (const x of [-0.55, 0, 0.55]) {
      H.P(foot, H.ballS, fc, [x * r * 0.75, r * 0.22, r * 1.75], [r * 0.3, r * 0.26, r * 0.35]);
      if (f === "claw") H.P(foot, H.tube("toeclaw", t => [0, -t * t * 0.02, t * 0.05], t => 0.02 * (1 - t) + 0.001, 8, 6), a.claw ?? 0xeee6d2, [x * r * 0.75, r * 0.22, r * 1.95], r * 5);
    }
  } else if (f === "boot") {
    H.O(foot, H.lathe("boot", [[0, 0], [1.1, 0], [1.05, 0.4], [0.95, 1.4], [1.0, 2.4], [0, 2.45]], 28), fc, [0, 0, 0], [r, r, r]);
    H.O(foot, H.ball, fc, [0, r * 0.35, r * 0.7], [r * 1.0, r * 0.55, r * 1.35]);
    H.P(foot, H.lathe("sole", [[0, 0], [1, 0], [1, 0.1], [0, 0.12]], 28), 0x1c1a20, [0, 0, r * 0.45], [r * 1.05, r, r * 1.7]);
  } else if (f === "shoe" || f === "heel" || f === "tabi") {
    H.O(foot, H.ball, fc, [0, r * 0.35, r * 0.55], [r * 0.95, r * 0.55, r * 1.45]);
    if (f === "heel") {
      H.P(foot, H.lathe("heelpin", [[0, 0], [0.3, 0], [0.4, 0.7], [0.6, 1.0], [0, 1.02]], 16), fc, [0, -r * 0.6, -r * 0.6], [r * 0.5, r * 0.9, r * 0.5]);
      foot.rotation.x = 0.25;
    }
    if (f === "tabi") H.P(foot, H.ballS, fc, [-side * r * 0.35, r * 0.3, r * 1.6], [r * 0.3, r * 0.3, r * 0.4]);
  } else if (f === "zori" || f === "geta") {
    H.O(foot, H.ball, a.sock ?? skin, [0, r * 0.35, r * 0.5], [r * 0.9, r * 0.5, r * 1.35]);
    if (a.sock) H.P(foot, H.seg("shin", r * 1.2, r * 0.8), a.sock, [0, r * 1.25, 0]);
    const sole = H.lathe("zori", [[0, 0], [1, 0], [1, 0.12], [0, 0.14]], 28);
    H.P(foot, sole, fc, [0, -r * 0.05, r * 0.5], [r * 1.05, r, r * 1.65]);
    if (f === "geta") for (const z of [-0.4, 1.3]) H.P(foot, H.lathe("tooth", [[0, 0], [0.7, 0], [0.7, 1], [0, 1]], 4), fc, [0, -r * 0.45, z * r], [r * 1.2, r * 0.4, r * 0.25], [0, Math.PI / 4, 0]);
    H.P(foot, H.tube("hanao", t => [Math.cos(t * Math.PI) * 0.8, Math.sin(t * Math.PI) * 0.45, 0.2 - Math.sin(t * Math.PI) * 0.35], 0.09, 16, 6), a.strap ?? 0x1c1a20, [0, r * 0.1, r * 0.6], r);
  }
  return { leg, knee, foot };
}

// ゆらめく炎（しっぽの先・鬼火）
function hiFlame(H, par, p, r, c, core = 0xffffff) {
  const k = H.k, g = k.group(par, p);
  const shape = H.lathe("flame", [[0, -1], [0.55, -0.8], [0.85, -0.35], [0.8, 0.1], [0.55, 0.6], [0.25, 1.1], [0.06, 1.5], [0, 1.6]], 24);
  H.P(g, shape, c, [0, 0, 0], r, 0, { glow: shade(c, -0.2), alpha: 0.9 });
  H.P(g, shape, core, [0, -r * 0.15, 0], r * 0.55, 0, { basic: true, alpha: 0.5 });
  k.anim.push({ obj: g, flicker: true, phase: k.rnd() * 6, speed: 9 });
  return g;
}

// 髪の房をまとめた 1 つのジオメトリ。strands = [{ base, dir, len, r, droop, curl }]
function hiHair(key, strands, radial = 7) {
  return hiGeo("H:" + key, m => {
    for (const s of strands) {
      const d = kNorm(s.dir), L = s.len, droop = s.droop ?? 0.5, curl = s.curl ?? 0;
      m.tube(t => [s.base[0] + d[0] * L * t + curl * Math.sin(t * 3), s.base[1] + d[1] * L * t - L * t * t * droop, s.base[2] + d[2] * L * t], t => s.r * Math.pow(1 - t, s.taper ?? 0.9) + 0.002, 14, radial);
    }
  });
}
