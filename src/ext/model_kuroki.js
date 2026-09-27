// ============================================================================
// 黒鬼だけの超高精細 3D モデル（plan "kuroki"）。
// ほかの妖怪は基本形（球・円柱・円すい・箱）を組むが、黒鬼は曲面を 1 から作る：
//   回転体（胴・手足・金棒）・曲がった管（角・髪・指・牙・模様）を細かい頂点で組み、法線をなめらかにする。
// 本家の説明（「漆黒の体に巨大な角を持つ 最も格が高いとされる鬼。戦いの血がたぎった時に現れる
// 鬼の一族特有の模様が全身に浮かび上がっている」）どおり、黒い体・大きな角・全身に光る模様・悪夢の金棒。
// 形は毎回同じなので、ジオメトリは 1 度だけ作って使い回す。
// 腕（userData.arms）・頭（headObj）は humanoid と同じつなぎ方なので、行動のモーションはそのまま効く。
// ============================================================================

// 頂点と三角形をためて 1 つのジオメトリにする
class KMesher {
  constructor() { this.pos = []; this.idx = []; }
  get n() { return this.pos.length / 3; }
  // rows × cols の格子（cols 方向は輪になる）。f(i, j) → [x, y, z]
  grid(rows, cols, f, xf) {
    const b = this.n;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const p = f(i, j);
      const q = xf ? xf(p) : p;
      this.pos.push(q[0], q[1], q[2]);
    }
    for (let i = 0; i < rows - 1; i++) for (let j = 0; j < cols; j++) {
      const a = b + i * cols + j, c = b + i * cols + (j + 1) % cols, d = a + cols, e = c + cols;
      this.idx.push(a, c, d, c, e, d);
    }
    return this;
  }
  // 回転体。prof = [[半径, 高さ], …]（下から上）。sx・sz で断面をつぶす
  lathe(prof, seg = 48, xf, sx = 1, sz = 1) {
    return this.grid(prof.length, seg, (i, j) => {
      const a = -j / seg * Math.PI * 2, [r, y] = prof[i];
      return [Math.cos(a) * r * sx, y, Math.sin(a) * r * sz];
    }, xf);
  }
  // 曲がった管。cf(t) → 中心、rf(t) → 太さ。両はしは閉じる
  tube(cf, rf, n = 32, radial = 10, xf) {
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
      const k = Math.min(n, Math.max(0, i - 1)), r = i === 0 || i === rows - 1 ? 0 : rf(k / n);
      const a = j / radial * Math.PI * 2, [nn, bb] = F[k], p = P[k];
      const c = Math.cos(a) * r, s = Math.sin(a) * r;
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
// 点を回して動かす（x → y → z の順に回す）
function kXf(p = [0, 0, 0], r = [0, 0, 0], s = 1) {
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(r[0]), Math.sin(r[0]), Math.cos(r[1]), Math.sin(r[1]), Math.cos(r[2]), Math.sin(r[2])];
  return q => {
    let [x, y, z] = [q[0] * s, q[1] * s, q[2] * s];
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

// ---- 形（1 度だけ作る） ----
var KUROKI_GEO = null;
var KP = { // 回転体の断面（半径, 高さ）
  torso: [[0, -0.42], [0.2, -0.41], [0.3, -0.36], [0.33, -0.28], [0.31, -0.18], [0.3, -0.08], [0.33, 0.04], [0.39, 0.16], [0.44, 0.26], [0.45, 0.32], [0.41, 0.37], [0.3, 0.41], [0.16, 0.43], [0, 0.44]],
  upperArm: [[0, 0.02], [0.1, 0], [0.13, -0.06], [0.145, -0.14], [0.14, -0.22], [0.12, -0.3], [0.1, -0.38], [0.095, -0.42], [0, -0.45]],
  foreArm: [[0, -0.4], [0.1, -0.42], [0.125, -0.48], [0.13, -0.55], [0.12, -0.63], [0.095, -0.72], [0.085, -0.8], [0.08, -0.84], [0, -0.86]],
  thigh: [[0, 0.03], [0.14, 0], [0.165, -0.08], [0.17, -0.18], [0.15, -0.3], [0.12, -0.4], [0.11, -0.45], [0, -0.48]],
  shin: [[0, -0.43], [0.11, -0.45], [0.125, -0.52], [0.135, -0.6], [0.12, -0.7], [0.09, -0.82], [0.075, -0.9], [0, -0.93]],
  skirt: [[0.32, 0.12], [0.36, 0.06], [0.39, -0.04], [0.42, -0.14], [0.44, -0.22]],
  club: [[0, 0.3], [0.05, 0.3], [0.07, 0.36], [0.1, 0.6], [0.135, 0.9], [0.16, 1.18], [0.165, 1.3], [0.14, 1.36], [0, 1.38]],
};
function kurokiGeo() {
  if (KUROKI_GEO) return KUROKI_GEO;
  const G = {}, M = f => { const m = new KMesher(); f(m); return m.geometry(); };
  const ball = (rows, cols) => M(m => m.grid(rows + 1, cols, (i, j) => { const v = i / rows * Math.PI, a = -j / cols * Math.PI * 2; return [Math.sin(v) * Math.cos(a), -Math.cos(v), Math.sin(v) * Math.sin(a)]; }));
  G.sph = ball(32, 48);
  G.sphS = ball(14, 20); // 目・鼻の穴・腹筋など小さな部品
  G.torso = M(m => m.lathe(KP.torso, 64, null, 1.2, 0.78));
  G.upperArm = M(m => m.lathe(KP.upperArm));
  G.foreArm = M(m => m.lathe(KP.foreArm));
  G.thigh = M(m => m.lathe(KP.thigh));
  G.shin = M(m => m.lathe(KP.shin));
  G.skirt = M(m => { m.lathe(KP.skirt, 64, null, 1.12, 0.86); m.lathe(KP.skirt.map(([r, y]) => [r - 0.015, y]).reverse(), 64, null, 1.12, 0.86); });
  // ぎざぎざの裾
  G.hem = M(m => { for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, L = 0.07 + (i * 7 % 5) * 0.012; m.lathe([[0, 0], [0.04, 0], [0.03, -L * 0.5], [0, -L]], 8, kXf([Math.cos(a) * 0.43 * 1.12, -0.21, Math.sin(a) * 0.43 * 0.86])); } });
  // 虎皮の縞（腰巻きにはりつく細い帯）
  G.stripes = M(m => {
    for (let i = 0; i < 14; i++) {
      const a0 = i / 14 * Math.PI * 2 + 0.2, y0 = 0.08 - (i % 3) * 0.05;
      m.tube(t => { const y = y0 - t * 0.2, r = kRadAt(KP.skirt, y) + 0.01, a = a0 + Math.sin(t * 3) * 0.08; return [Math.cos(a) * r * 1.12, y, Math.sin(a) * r * 0.86]; }, t => 0.02 * Math.sin(Math.PI * Math.min(1, t * 1.1)) + 0.003, 12, 6);
    }
  });
  // 縄の帯（ねじれた 2 本）
  G.rope = M(m => { for (const ph of [0, Math.PI]) m.tube(t => { const a = t * Math.PI * 2, tw = a * 9 + ph; return [Math.cos(a) * (0.345 + Math.cos(tw) * 0.018) * 1.18, Math.sin(tw) * 0.018, Math.sin(a) * (0.345 + Math.cos(tw) * 0.018) * 0.8]; }, () => 0.022, 160, 8); });
  G.ring = M(m => m.tube(t => [Math.cos(t * Math.PI * 2), 0, Math.sin(t * Math.PI * 2)], () => 0.16, 48, 10));
  // 角：付け根は太く、外へ張り出してから上へ反り、先は細くとがる。節の筋つき
  const hornC = t => [0.02 + Math.sin(t * 1.9) * 0.26, t * 0.52 + Math.pow(t, 2) * 0.08, -0.06 + Math.sin(t * 2.6) * 0.07 - t * 0.02];
  G.horn = M(m => m.tube(hornC, t => 0.085 * Math.pow(1 - t, 0.85) * (1 + 0.06 * Math.sin(t * 60)) + 0.003, 64, 16));
  G.hornTip = M(m => m.tube(t => hornC(0.72 + t * 0.28), t => (0.085 * Math.pow(0.28 * (1 - t), 0.85) + 0.003) * 1.12 + 0.002, 24, 16));
  // 髪：頭の後ろ半分からうしろへ流れて広がる、ぼさぼさの白髪（1 つのジオメトリに 90 本）
  G.hair = M(m => {
    for (let i = 0; i < 90; i++) {
      const u = (i * 0.618034) % 1, v = (i * 0.381966 + 0.13) % 1;
      const az = Math.PI * (0.15 + u * 1.7), el = 0.15 + v * 1.25;
      const base = [Math.cos(az) * Math.cos(el) * 0.25, Math.sin(el) * 0.25 + 0.02, -Math.abs(Math.sin(az)) * Math.cos(el) * 0.24 - 0.02];
      const dir = kNorm([base[0] * 1.3, 0.15 + (1 - v) * 0.2, -0.45 - v * 0.2]);
      const L = 0.3 + ((i * 37) % 11) / 11 * 0.28, curl = ((i * 13) % 7 - 3) * 0.03;
      m.tube(t => [base[0] + dir[0] * L * t + curl * Math.sin(t * 3), base[1] + dir[1] * L * t - L * t * t * 0.55, base[2] + dir[2] * L * t], t => 0.045 * Math.pow(1 - t, 0.9) + 0.002, 14, 7);
    }
    // 前髪・もみあげ
    for (let i = 0; i < 12; i++) {
      const x = (i / 11 - 0.5) * 0.4, side = Math.sign(x) || 1;
      m.tube(t => [x + side * t * 0.06, 0.2 - t * (Math.abs(x) > 0.15 ? 0.3 : 0.08), 0.15 + t * 0.05 - (Math.abs(x) > 0.15 ? 0.05 : 0)], t => 0.035 * (1 - t) + 0.002, 10, 7);
    }
  });
  // 眉（太く、つり上がる）
  G.brow = M(m => m.tube(t => [0.02 + t * 0.15, 0.1 + t * 0.045 - t * t * 0.01, 0.225 - t * t * 0.06], t => 0.026 * (1 - t * 0.5), 20, 10));
  // 上の牙・下からのびる牙
  G.fang = M(m => m.tube(t => [0, -t * 0.07, t * t * 0.012], t => 0.016 * (1 - t) + 0.001, 12, 10));
  G.tusk = M(m => m.tube(t => [t * 0.01, t * 0.11, t * t * 0.03], t => 0.022 * (1 - t) + 0.001, 16, 10));
  G.ear = M(m => m.tube(t => [t * 0.1, t * 0.05, -t * 0.03], t => 0.045 * Math.pow(1 - t, 0.7) + 0.003, 16, 12, null));
  // 指（こぶしを握る）・爪
  G.finger = M(m => m.tube(t => { const a = t * 2.2; return [0, -Math.sin(a) * 0.06, (Math.cos(a) - 1) * -0.06 * 0.6]; }, () => 0.028, 20, 10));
  G.claw = M(m => m.tube(t => [0, -t * 0.03, t * 0.02 - t * t * 0.02], t => 0.014 * (1 - t) + 0.001, 10, 8));
  G.toe = M(m => m.tube(t => [0, -t * t * 0.02, t * 0.08], t => 0.035 * (1 - t * 0.3), 12, 10));
  // 腕輪のとげ・金棒のいぼ
  G.spike = M(m => m.lathe([[0, 0], [0.028, 0], [0.024, 0.02], [0.012, 0.045], [0, 0.06]], 16));
  G.stud = M(m => m.lathe([[0, 0], [0.03, 0], [0.028, 0.012], [0.016, 0.034], [0, 0.05]], 12));
  G.club = M(m => m.lathe(KP.club, 8));
  G.grip = M(m => { m.lathe([[0, -0.08], [0.05, -0.08], [0.052, -0.05], [0.036, -0.03], [0.036, 0.3], [0, 0.3]], 32); for (let i = 0; i < 9; i++) m.tube(t => { const a = t * Math.PI * 2; return [Math.cos(a) * 0.04, i * 0.034 + t * 0.03, Math.sin(a) * 0.04]; }, () => 0.008, 32, 6); });
  // 模様（戦いで浮かび上がる鬼の一族の模様）。体にはわせた光る筋
  const onLathe = (prof, sx, sz, lift = 0.006) => (a, y) => { const r = kRadAt(prof, y) + lift; return [Math.cos(a) * r * sx, y, Math.sin(a) * r * sz]; };
  const TOR = onLathe(KP.torso, 1.2, 0.78);
  const glowW = t => 0.011 * Math.sin(Math.PI * t) + 0.003;
  G.markTorso = M(m => {
    for (const s of [-1, 1]) {
      // 胸の上から、みぞおちへ向かう稲妻形
      m.tube(t => TOR(Math.PI / 2 - s * (0.95 - t * 0.8), 0.32 - t * 0.3 - Math.sin(t * 9) * 0.02), glowW, 40, 6);
      // 脇腹のうねる 3 本
      for (let k = 0; k < 3; k++) m.tube(t => TOR(Math.PI / 2 - s * (1.25 + t * 0.35), 0.05 - k * 0.1 - Math.sin(t * Math.PI) * 0.05), glowW, 24, 6);
      // 背中の大きな曲線
      m.tube(t => TOR(-Math.PI / 2 + s * (0.2 + t * 0.9), 0.3 - t * 0.55 + Math.sin(t * 4) * 0.04), glowW, 40, 6);
    }
    m.tube(t => TOR(Math.PI / 2, 0.02 - t * 0.3), glowW, 20, 6); // おなかの縦筋
  });
  const helix = (prof, y0, y1, turns, ph) => M(m => m.tube(t => onLathe(prof, 1, 1, 0.005)(ph + t * turns * Math.PI * 2, y0 + (y1 - y0) * t), glowW, 60, 6));
  G.markUpper = helix(KP.upperArm, -0.06, -0.36, 1.2, 0.5);
  G.markFore = helix(KP.foreArm, -0.47, -0.66, 0.9, 2.2);
  G.markThigh = helix(KP.thigh, -0.04, -0.38, 1.1, 1);
  G.markShin = helix(KP.shin, -0.5, -0.8, 0.8, 3);
  // 顔の隈取り（目の下からほおへ）
  G.markFace = M(m => { for (const s of [-1, 1]) m.tube(t => { const a = Math.PI / 2 - s * (0.35 + t * 0.7), y = -0.01 - t * 0.1; const r = Math.sqrt(Math.max(0, 1 - ((y - 0.02) / 0.26) ** 2)) * 1.03; return [Math.cos(a) * 0.25 * r, y, Math.sin(a) * 0.24 * r]; }, glowW, 20, 6); });
  // 輪郭線
  for (const key of ["torso", "upperArm", "foreArm", "thigh", "shin"]) G[key + "OL"] = kInflate(G[key], 0.018);
  G.sphOL = kInflate(G.sph, 0.06);
  G.hornOL = kInflate(G.horn, 0.012);
  return KUROKI_GEO = G;
}

PLANS.kuroki = (k, o) => {
  const G = kurokiGeo();
  const skin = o.skin ?? 0x2a2a34, hairC = o.hairColor ?? 0xd8d8d8, pelt = o.pelt ?? 0xd9483b;
  const horn = o.hornColor ?? 0xe8dcc0, gold = 0xd9b24a, iron = 0x34343e, metal = 0xb8bcc8;
  const glow = { glow: 0xff2a10 }, mark = 0xff5a2a, muscle = shade(skin, 0.1), deep = shade(skin, -0.25);
  const ol = (mesh, g) => { const m = new pt(g, k.mat(0x14101c, { basic: true })); m.material.side = Lt; mesh.add(m); return mesh; };
  const P = (par, g, c, p, s, r, opt) => k.part(par, g, c, Array.isArray(p) ? p : [0, 0, 0], s, r, opt);
  const body = k.group(null);
  // ---- 脚 ----
  const hipY = 1.02;
  for (const s of [-1, 1]) {
    const leg = k.group(body, [s * 0.2, hipY, 0], [0, 0, s * 0.05]);
    ol(P(leg, G.thigh, skin), G.thighOL);
    P(leg, G.markThigh, mark, 0, 1, 0, glow);
    const knee = k.group(leg, [0, -0.02, 0.02], [0.08, 0, 0]);
    P(knee, G.sph, muscle, [0, -0.46, 0.05], [0.11, 0.1, 0.1]);
    ol(P(knee, G.shin, skin), G.shinOL);
    P(knee, G.markShin, mark, 0, 1, 0, glow);
    // 足首の金の輪
    P(knee, G.ring, gold, [0, -0.85, 0], [0.092, 0.13, 0.092], 0, { glow: 0x2a1800 });
    // 足：大きな甲・かかと・3 本の指と爪
    const foot = k.group(knee, [0, -0.92, 0], [-0.08, s * 0.12, 0]);
    ol(P(foot, G.sph, skin, [0, 0.04, 0.06], [0.12, 0.07, 0.19]), G.sphOL);
    P(foot, G.sph, deep, [0, 0.03, -0.08], [0.09, 0.06, 0.08]);
    for (const x of [-0.06, 0, 0.06]) {
      P(foot, G.toe, skin, [x, 0.04, 0.2], 1, [0, x * -2, 0]);
      P(foot, G.claw, 0xe8e0cc, [x * 1.12, 0.035, 0.29], 1, [0, x * -2, 0]);
    }
  }
  // ---- 腰巻き（虎皮）と縄の帯 ----
  const waist = k.group(body, [0, hipY + 0.05, 0]);
  P(waist, G.skirt, pelt);
  P(waist, G.hem, pelt);
  P(waist, G.stripes, 0x1c1418);
  P(waist, G.rope, 0xf0e6cc, [0, 0.1, 0]);
  // 前に垂れる房
  for (const s of [-1, 1]) P(waist, G.sphS, 0xf0e6cc, [s * 0.09, 0.02, 0.33], [0.035, 0.08, 0.035]);
  // ---- 胴（筋肉の盛り上がりつき） ----
  const torsoY = 1.5;
  const chest = k.group(body, [0, torsoY, 0]);
  ol(P(chest, G.torso, skin), G.torsoOL);
  for (const s of [-1, 1]) {
    P(chest, G.sph, muscle, [s * 0.2, 0.2, 0.27], [0.2, 0.12, 0.09], [0, s * 0.25, s * 0.15]); // 胸
    P(chest, G.sph, muscle, [s * 0.18, 0.37, -0.08], [0.2, 0.08, 0.16], [0, 0, s * -0.35]); // 僧帽筋
    P(chest, G.sph, muscle, [s * 0.34, 0.02, 0.1], [0.07, 0.22, 0.12], [0, 0, s * 0.15]); // 脇腹
    P(chest, G.sph, muscle, [s * 0.22, 0.12, -0.24], [0.18, 0.2, 0.08], [0, s * -0.3, 0]); // 背中
    for (let r = 0; r < 3; r++) P(chest, G.sphS, muscle, [s * 0.075, 0.02 - r * 0.1, 0.235 - r * 0.004], [0.065, 0.045, 0.035]); // 腹筋
  }
  P(chest, G.markTorso, mark, 0, 1, 0, glow);
  // 首
  P(chest, G.sph, skin, [0, 0.46, 0], [0.16, 0.14, 0.14]);
  // ---- 腕（0 = 左、1 = 右で金棒） ----
  const shY = torsoY + 0.3;
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    const sh = k.group(body, [s * 0.54, shY, 0], [0, 0, s * 0.28]);
    ol(P(sh, G.sph, muscle, [s * 0.02, 0, 0], [0.17, 0.15, 0.16]), G.sphOL); // 肩
    ol(P(sh, G.upperArm, skin), G.upperArmOL);
    P(sh, G.markUpper, mark, 0, 1, 0, glow);
    P(sh, G.sph, muscle, [0, -0.17, 0.08], [0.09, 0.13, 0.08]); // 力こぶ
    P(sh, G.sph, skin, [0, -0.42, 0], [0.105]); // ひじ
    ol(P(sh, G.foreArm, skin), G.foreArmOL);
    P(sh, G.markFore, mark, 0, 1, 0, glow);
    // とげつきの金の腕輪
    P(sh, G.ring, gold, [0, -0.72, 0], [0.11, 0.2, 0.11], 0, { glow: 0x2a1800 });
    for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; P(sh, G.spike, metal, [Math.cos(a) * 0.122, -0.72, Math.sin(a) * 0.122], 1, [0, -a, -Math.PI / 2]); }
    // こぶし：手のひら・握った 4 本の指・親指・爪
    const hand = k.group(sh, [0, -0.9, 0]);
    ol(P(hand, G.sph, skin, [0, 0, 0], [0.1, 0.1, 0.085]), G.sphOL);
    for (let f = 0; f < 4; f++) {
      const x = (f - 1.5) * 0.045;
      P(hand, G.finger, skin, [x, -0.04, 0.06], 1, [0, 0, 0]);
      P(hand, G.claw, 0xe8e0cc, [x, -0.1, 0.03], 1, [Math.PI * 0.9, 0, 0]);
    }
    P(hand, G.finger, skin, [-s * 0.08, 0.01, 0.05], 0.9, [0, 0, -s * 1.2]);
    if (i === 1) kurokiClub(k, hand, G, { iron, metal, gold });
    k.swing(sh, "x", 0.14, 1.4, i);
    (k.arms ??= []).push(sh);
  }
  // ---- 頭 ----
  const headY = torsoY + 0.66;
  const head = k.group(body, [0, headY, 0.03]);
  ol(P(head, G.sph, skin, [0, 0.02, 0], [0.25, 0.26, 0.24]), G.sphOL);
  // あご（角ばって前に出る）・ほお骨・鼻
  P(head, G.sph, skin, [0, -0.13, 0.05], [0.2, 0.12, 0.19]);
  for (const s of [-1, 1]) P(head, G.sphS, muscle, [s * 0.13, -0.02, 0.15], [0.07, 0.05, 0.06]);
  P(head, G.sphS, muscle, [0, -0.02, 0.23], [0.05, 0.045, 0.05]);
  for (const s of [-1, 1]) P(head, G.sphS, 0x0a0a10, [s * 0.022, -0.035, 0.265], [0.013, 0.009, 0.01]); // 鼻の穴
  // 目：金に光る目と縦長の瞳・その上の太い眉と彫りの深い影
  for (const s of [-1, 1]) {
    P(head, G.sphS, deep, [s * 0.085, 0.05, 0.19], [0.07, 0.045, 0.04]);
    P(head, G.sphS, 0xffe070, [s * 0.085, 0.045, 0.215], [0.052, 0.033, 0.025], [0, 0, s * 0.25], { glow: 0xffa020 });
    P(head, G.sphS, 0xd01808, [s * 0.082, 0.045, 0.232], [0.02, 0.026, 0.01], 0, glow);
    P(head, G.sphS, 0x0a0406, [s * 0.082, 0.045, 0.238], [0.006, 0.022, 0.006]);
    P(head, G.brow, hairC, [0, 0, 0], [s, 1, 1]);
  }
  P(head, G.markFace, mark, 0, 1, 0, glow);
  // 口：大きく横に割れ、上の牙 4 本・下から突き出る牙 2 本
  P(head, G.sphS, 0x2a0810, [0, -0.13, 0.2], [0.11, 0.028, 0.03]);
  for (const x of [-0.06, -0.025, 0.025, 0.06]) P(head, G.fang, 0xfaf6ee, [x, -0.115, 0.225], Math.abs(x) > 0.04 ? 1.3 : 0.8);
  for (const s of [-1, 1]) P(head, G.tusk, 0xf4ecd8, [s * 0.1, -0.16, 0.19], 1, [0, 0, s * -0.25]);
  // とがった耳と金の耳飾り
  for (const s of [-1, 1]) {
    P(head, G.ear, skin, [s * 0.22, 0.0, -0.01], [s, 1, 1]);
    P(head, G.ring, gold, [s * 0.255, -0.075, 0.0], [0.035, 0.035, 0.035], [0, 0, Math.PI / 2], { glow: 0x2a1800 });
  }
  P(head, G.hair, hairC);
  // 巨大な角 2 本（骨の色、先は黒ずむ）
  for (const s of [-1, 1]) {
    const hg = k.group(head, [s * 0.1, 0.17, 0.02], [0, 0, 0]);
    hg.scale.set(s, 1, 1);
    ol(P(hg, G.horn, horn), G.hornOL);
    P(hg, G.hornTip, 0x4a3a30);
  }
  k.bob(head, 0.012, 2);
  return { body, head, top: headY + 0.8 };
};

// 悪夢の金棒：八角の鉄の棒に いぼ 72 個・金の帯・巻いた柄
function kurokiClub(k, hand, G, c) {
  const g = k.group(hand, [0, 0, 0.02], [Math.PI / 2 - 0.2, 0, 0]);
  k.part(g, G.grip, 0x4a2a1a);
  k.part(g, G.club, c.iron, [0, 0, 0], 1, 0, { flat: true });
  for (const y of [0.33, 1.3]) k.part(g, G.ring, c.gold, [0, y, 0], y > 1 ? [0.175, 0.22, 0.175] : [0.075, 0.15, 0.075], 0, { glow: 0x2a1800 });
  for (let r = 0; r < 9; r++) for (let j = 0; j < 8; j++) {
    const y = 0.45 + r * 0.1, a = (j + 0.5) / 8 * Math.PI * 2 + (r % 2) * 0.12, rad = kRadAt(KP.club, y) * Math.cos(Math.PI / 8) - 0.004;
    k.part(g, G.stud, c.metal, [Math.cos(a) * rad, y, Math.sin(a) * rad], 1, [0, -a, -Math.PI / 2]);
  }
  k.part(g, G.stud, c.metal, [0, 1.37, 0], 1.4);
  return g;
}
