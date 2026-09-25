// ============================================================================
// 全員の 3D モデル。
// 形（体つき）は一族ごとに決め、色・大きさ・飾りは 1 体ずつ変える（段階が上がるほど大きく豪華）。
// three.js の基本形（球・円柱・円すい・箱）を組み合わせて作るので、外部ファイルは要らない。
//
// バンドル内の three.js の名前： qr=Group, pt=Mesh, fd=Sphere, pd=Cylinder, x1=Cone, zr=Box,
//   M1=Ring, Dl=MeshLambertMaterial, Aa=MeshBasicMaterial, Ge=Color, Lt=BackSide
// モデルの正面は +Z、足もとが y=0。
// ============================================================================

var GEO = null;
function geo() {
  if (!GEO) GEO = {
    sph: new fd(1, 20, 14), sphLo: new fd(1, 10, 8), cyl: new pd(1, 1, 1, 16), cylLo: new pd(1, 1, 1, 8),
    cone: new x1(1, 1, 16), box: new zr(1, 1, 1), ring: new M1(0.8, 1, 32), halfSph: new fd(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  };
  return GEO;
}

function rgbHex(c) { return typeof c === "number" ? c : parseInt(String(c).replace("#", ""), 16); }
function shade(c, k) {
  const h = rgbHex(c), r = h >> 16 & 255, g = h >> 8 & 255, b = h & 255;
  const f = x => Math.max(0, Math.min(255, Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k))));
  return f(r) << 16 | f(g) << 8 | f(b);
}
function hslHex(h, s, l) {
  const c = new Ge();
  c.setHSL((h % 360 + 360) % 360 / 360, s, l);
  return c.getHex();
}

// 部品を置くための道具
class ModelKit {
  constructor(seed) {
    this.root = new qr();
    this.mats = new Map();
    this.anim = [];
    this.seed = seed >>> 0;
  }
  rnd() { // 決まった順に出る乱数（同じ妖怪なら毎回同じ形）
    this.seed = Math.imul(this.seed ^ this.seed >>> 15, 2246822507) + 0x6d2b79f5 >>> 0;
    return (this.seed >>> 8) / 16777216;
  }
  mat(color, o = {}) {
    const key = rgbHex(color) + JSON.stringify(o);
    if (!this.mats.has(key)) {
      const m = o.basic ? new Aa({ color: rgbHex(color), transparent: !!o.alpha, opacity: o.alpha ?? 1, depthWrite: !o.alpha })
        : new Dl({ color: rgbHex(color), emissive: rgbHex(o.glow ?? 0), transparent: !!o.alpha, opacity: o.alpha ?? 1, flatShading: !!o.flat });
      m.userData.baseOpacity = o.alpha ?? 1;
      m.userData.baseEmissive = rgbHex(o.glow ?? 0);
      this.mats.set(key, m);
    }
    return this.mats.get(key);
  }
  part(parent, g, color, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], o = {}) {
    if (!Array.isArray(r)) r = [0, 0, 0];
    if (typeof s === "number") s = [s, s, s];
    o = o ?? {};
    const m = new pt(geo()[g], this.mat(color, o));
    m.position.set(p[0], p[1], p[2]);
    m.scale.set(s[0], s[1] ?? s[0], s[2] ?? s[0]);
    m.rotation.set(r[0], r[1], r[2]);
    (parent ?? this.root).add(m);
    if (o.outline) {
      const ol = new pt(geo()[g], this.mat(0x14101c, { basic: true }));
      ol.material.side = Lt;
      ol.scale.set(1.07, 1.07, 1.07);
      m.add(ol);
    }
    return m;
  }
  group(parent, p = [0, 0, 0], r = [0, 0, 0]) {
    const g = new qr();
    g.position.set(p[0], p[1], p[2]);
    g.rotation.set(r[0], r[1], r[2]);
    (parent ?? this.root).add(g);
    return g;
  }
  sph(par, c, p, s, r, o) { return this.part(par, "sph", c, p, s, r, o); }
  cyl(par, c, p, s, r, o) { return this.part(par, "cyl", c, p, s, r, o); }
  cone(par, c, p, s, r, o) { return this.part(par, "cone", c, p, s, r, o); }
  box(par, c, p, s, r, o) { return this.part(par, "box", c, p, s, r, o); }
  // 目：style = round / angry / slit / sleepy / glow
  eyes(par, y, z, gap, size, style = "round", n = 2, eyeColor = 0xffffff) {
    const xs = n === 1 ? [0] : n === 3 ? [-gap, 0, gap] : [-gap, gap];
    for (const x of xs) {
      const yy = n === 3 && x === 0 ? y + size * 1.4 : y;
      if (style === "glow") { this.sph(par, 0xfff2a0, [x, yy, z], [size, size, size * 0.6], 0, { glow: 0xffd84a }); continue; }
      this.sph(par, eyeColor, [x, yy, z], [size, size * (style === "sleepy" ? 0.45 : 1.05), size * 0.55]);
      const pup = style === "slit" ? [size * 0.22, size * 0.8, size * 0.3] : [size * 0.5, size * 0.55, size * 0.3];
      this.sph(par, style === "slit" ? 0x2a1a08 : 0x120e18, [x + (n === 1 ? 0 : x > 0 ? -size * 0.12 : size * 0.12), yy, z + size * 0.42], pup);
      if (style === "angry") this.box(par, 0x1a1420, [x, yy + size * 1.05, z + size * 0.2], [size * 1.5, size * 0.28, size * 0.3], [0, 0, x > 0 ? 0.45 : -0.45]);
    }
  }
  mouth(par, y, z, w, kind = "smile") {
    if (kind === "fang") {
      this.box(par, 0x2a0c12, [0, y, z], [w, w * 0.28, w * 0.2]);
      for (const x of [-w * 0.3, w * 0.3]) this.cone(par, 0xffffff, [x, y - w * 0.18, z + w * 0.08], [w * 0.1, w * 0.25, w * 0.1], [Math.PI, 0, 0]);
    } else if (kind === "open") {
      this.sph(par, 0x5a1020, [0, y, z], [w * 0.5, w * 0.35, w * 0.2]);
    } else {
      this.box(par, 0x2a0c12, [0, y, z], [w, w * 0.12, w * 0.1]);
    }
  }
  horn(par, c, p, len, tilt, rz = 0) { return this.cone(par, c, p, [len * 0.28, len, len * 0.28], [tilt, 0, rz]); }
  // ゆらゆら動かす部品
  swing(obj, axis, amp, speed, phase = 0) { this.anim.push({ obj, axis, amp, speed, phase: phase + this.rnd() * 6, base: obj.rotation[axis] }); return obj; }
  bob(obj, amp, speed) { this.anim.push({ obj, axis: "y", amp, speed, phase: this.rnd() * 6, base: obj.position.y, pos: true }); return obj; }
  // 球をならべた「しっぽ」「胴」
  chain(par, c, pts, r0, r1, o) {
    const out = [];
    pts.forEach((p, i) => {
      const t = pts.length === 1 ? 0 : i / (pts.length - 1);
      const r = r0 + (r1 - r0) * t;
      out.push(this.sph(par, typeof c === "function" ? c(i) : c, p, [r, r, r], 0, o));
    });
    return out;
  }
}

// ---- 体つきのパーツ ----
function humanoid(k, o) {
  const b = { slim: [0.34, 0.62, 0.26], bulky: [0.5, 0.66, 0.4], child: [0.3, 0.42, 0.26], tall: [0.34, 0.8, 0.28], fat: [0.52, 0.56, 0.48] }[o.build ?? "slim"];
  const legH = o.robe ? 0 : (o.longLegs ? 0.95 : o.build === "child" ? 0.3 : 0.45);
  const skin = o.skin, cloth = o.cloth ?? shade(skin, -0.35);
  const torsoY = legH + b[1] * 0.5;
  const body = k.group(null, [0, 0, 0]);
  // 足
  if (o.noLegs) { /* 下は別の体（蛇・蜘蛛）につながる */ } else if (!o.robe) for (const x of [-b[0] * 0.45, b[0] * 0.45]) {
    k.cyl(body, o.legColor ?? skin, [x, legH / 2, 0], [b[0] * 0.24, legH, b[0] * 0.24]);
    k.box(body, o.footColor ?? 0x3a2a22, [x, 0.04, 0.05], [b[0] * 0.36, 0.08, b[0] * 0.55]);
  } else {
    k.cone(body, cloth, [0, 0.42, 0], [b[0] * 1.35, 0.9, b[2] * 1.5], 0, { outline: true });
  }
  // 胴
  const torso = k.sph(body, o.robe ? cloth : (o.torsoColor ?? skin), [0, torsoY + (o.robe ? 0.25 : 0), 0], [b[0], b[1] * 0.62, b[2]], 0, { outline: true });
  if (o.sash) k.cyl(body, o.sash, [0, torsoY + (o.robe ? 0.18 : -0.08), 0], [b[0] * 1.02, 0.1, b[2] * 1.05]);
  if (o.pelt) k.cyl(body, o.pelt, [0, legH + 0.05, 0], [b[0] * 1.05, 0.2, b[2] * 1.1]);
  const neckY = torsoY + (o.robe ? 0.25 : 0) + b[1] * 0.55;
  // 首（ろくろ首など）
  let headY = neckY + (o.headSize ?? 0.34) * 0.8;
  if (o.longNeck) {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([Math.sin(i * 0.7) * 0.18, neckY + i * 0.12, Math.cos(i * 0.5) * 0.05]);
    k.chain(body, skin, pts, 0.07, 0.07);
    headY = neckY + 1.05;
  }
  // 腕
  const armLen = o.longArms ? 1.1 : b[1] * 0.9;
  const armN = o.arms ?? 2;
  for (let i = 0; i < armN; i++) {
    const side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
    const sh = k.group(body, [side * (b[0] + 0.02), neckY - 0.1 - row * 0.22, 0], [0, 0, side * (0.25 + row * 0.35)]);
    k.cyl(sh, o.sleeve ?? skin, [0, -armLen / 2, 0], [0.085 + b[0] * 0.08, armLen, 0.085 + b[0] * 0.08]);
    k.sph(sh, skin, [0, -armLen, 0], [0.1 + b[0] * 0.07]);
    if (i === 1 && o.weapon) weapon(k, sh, o.weapon, armLen, o);
    k.swing(sh, "x", 0.18, 1.6, i);
  }
  // 翼
  if (o.wings) wings(k, body, [0, neckY - 0.15, -b[2] * 0.8], o.wings, 0.9);
  if (o.tail) tail(k, body, [0, legH + 0.1, -b[2] * 0.9], o.tail, o.tailN ?? 1, o.tailColor ?? skin);
  if (o.shell) k.sph(body, o.shell, [0, torsoY, -b[2] * 0.7], [b[0] * 1.1, b[1] * 0.6, 0.22], 0, { outline: true });
  // 頭
  const head = k.group(body, [0, headY, 0]);
  headShape(k, head, o);
  k.bob(head, 0.02, 2.2);
  if (o.twoFaces) { const back = k.group(head, [0, 0, 0], [0, Math.PI, 0]); face(k, back, o.headSize ?? 0.34, { ...o, eyeStyle: "angry" }); }
  return { body, head, top: headY + (o.headSize ?? 0.34) };
}

function headShape(k, head, o) {
  const hs = o.headSize ?? 0.34, skin = o.headColor ?? o.skin;
  switch (o.head ?? "round") {
    case "bull":
      k.sph(head, skin, [0, 0, 0], [hs * 1.05, hs, hs], 0, { outline: true });
      k.sph(head, shade(skin, 0.25), [0, -hs * 0.25, hs * 0.75], [hs * 0.55, hs * 0.4, hs * 0.4]);
      for (const x of [-1, 1]) k.cone(head, 0xf4ead0, [x * hs * 1.05, hs * 0.35, 0], [hs * 0.16, hs * 0.9, hs * 0.16], [0, 0, -x * 1.2]);
      break;
    case "horse":
      k.sph(head, skin, [0, 0, hs * 0.2], [hs * 0.75, hs * 0.85, hs * 1.3], [0.3, 0, 0], { outline: true });
      for (const x of [-1, 1]) k.cone(head, skin, [x * hs * 0.4, hs * 0.85, -hs * 0.1], [hs * 0.14, hs * 0.5, hs * 0.14]);
      k.box(head, o.hairColor ?? 0x2a1a14, [0, hs * 0.6, -hs * 0.5], [hs * 0.2, hs * 0.5, hs * 1.2]);
      break;
    case "bird":
      k.sph(head, skin, [0, 0, 0], [hs, hs, hs], 0, { outline: true });
      k.cone(head, o.beak ?? 0xf2b33a, [0, -hs * 0.1, hs * 1.1], [hs * 0.28, hs * 0.8, hs * 0.22], [Math.PI / 2, 0, 0]);
      break;
    case "fox":
      k.sph(head, skin, [0, 0, 0], [hs, hs * 0.92, hs], 0, { outline: true });
      k.cone(head, skin, [0, -hs * 0.2, hs * 0.95], [hs * 0.38, hs * 0.7, hs * 0.3], [Math.PI / 2, 0, 0]);
      for (const x of [-1, 1]) k.cone(head, skin, [x * hs * 0.55, hs * 0.9, 0], [hs * 0.25, hs * 0.6, hs * 0.14], [0, 0, -x * 0.25]);
      break;
    case "skull":
      k.sph(head, 0xeee8d8, [0, 0, 0], [hs, hs * 1.05, hs], 0, { outline: true });
      break;
    case "none":
      return;
    default:
      k.sph(head, skin, [0, 0, 0], [hs, hs * (o.headTall ?? 1), hs], 0, { outline: true });
  }
  if (o.hair) hair(k, head, hs, o.hair, o.hairColor ?? 0x1c1820);
  face(k, head, hs, o);
  if (o.horns) {
    const hc = o.hornColor ?? 0xf4e6c8;
    if (o.horns === 1) k.horn(head, hc, [0, hs * 1.0, hs * 0.1], hs * 0.8, 0.1);
    else for (const x of [-1, 1]) k.horn(head, hc, [x * hs * 0.55, hs * 0.85, 0], hs * (o.hornLen ?? 0.7), 0.1, -x * 0.35);
  }
  if (o.nose === "long") k.cone(head, shade(skin, -0.05), [0, 0, hs * 1.2], [hs * 0.16, hs * 1.1, hs * 0.16], [Math.PI / 2, 0, 0]);
  if (o.hat) hat(k, head, hs, o.hat, o.hatColor ?? 0x2a2230);
  if (o.dish) { k.cyl(head, 0xdff2ff, [0, hs * 0.9, 0], [hs * 0.55, 0.05, hs * 0.55]); k.cyl(head, 0x9ec8e0, [0, hs * 0.93, 0], [hs * 0.45, 0.03, hs * 0.45]); }
  if (o.ears === "cat" || o.ears === "fox") for (const x of [-1, 1]) k.cone(head, skin, [x * hs * 0.55, hs * 0.85, 0], [hs * 0.25, hs * 0.55, hs * 0.14], [0, 0, -x * 0.3]);
  if (o.ears === "round") for (const x of [-1, 1]) k.sph(head, skin, [x * hs * 0.75, hs * 0.75, 0], [hs * 0.28, hs * 0.28, hs * 0.14]);
  if (o.mask) k.sph(head, o.mask, [0, 0, hs * 0.55], [hs * 0.8, hs * 0.9, hs * 0.5]);
}

function face(k, head, hs, o) {
  if (o.noFace) return;
  const z = hs * 0.86;
  k.eyes(head, hs * 0.12, z, hs * 0.36, hs * (o.eyeSize ?? 0.2), o.eyeStyle ?? "round", o.eyeN ?? 2, o.eyeColor);
  if (o.mouth !== "none") k.mouth(head, -hs * 0.38, hs * 0.9, hs * 0.45, o.mouth ?? "smile");
  if (o.blush) for (const x of [-1, 1]) k.sph(head, 0xf29aa8, [x * hs * 0.55, -hs * 0.2, hs * 0.75], [hs * 0.12, hs * 0.08, hs * 0.05]);
}

function hair(k, head, hs, kind, c) {
  if (kind === "long") {
    k.sph(head, c, [0, hs * 0.1, -hs * 0.15], [hs * 1.06, hs * 1.05, hs * 1.02]);
    k.box(head, c, [0, -hs * 1.0, -hs * 0.45], [hs * 1.7, hs * 2.2, hs * 0.5]);
    k.box(head, c, [0, hs * 0.55, hs * 0.55], [hs * 1.6, hs * 0.35, hs * 0.3]);
  } else if (kind === "bob") {
    k.sph(head, c, [0, hs * 0.15, -hs * 0.1], [hs * 1.08, hs * 1.0, hs * 1.05]);
    k.box(head, c, [0, hs * 0.55, hs * 0.6], [hs * 1.7, hs * 0.3, hs * 0.3]);
  } else if (kind === "wild") {
    for (let i = 0; i < 7; i++) k.cone(head, c, [Math.cos(i) * hs * 0.5, hs * 0.75, Math.sin(i * 1.7) * hs * 0.5 - hs * 0.2], [hs * 0.22, hs * 0.6, hs * 0.22], [-0.5 + Math.sin(i) * 0.3, 0, Math.cos(i * 2) * 0.6]);
  } else if (kind === "topknot") {
    k.sph(head, c, [0, hs * 0.35, -hs * 0.1], [hs * 1.02, hs * 0.75, hs * 1.0]);
    k.cyl(head, c, [0, hs * 1.05, -hs * 0.3], [hs * 0.14, hs * 0.4, hs * 0.14], [-0.6, 0, 0]);
  } else if (kind === "bun") {
    k.sph(head, c, [0, hs * 0.2, -hs * 0.1], [hs * 1.05, hs * 0.95, hs * 1.02]);
    k.sph(head, c, [0, hs * 1.05, -hs * 0.2], [hs * 0.42]);
  }
}

function hat(k, head, hs, kind, c) {
  if (kind === "kasa") k.cone(head, c, [0, hs * 1.1, 0], [hs * 1.7, hs * 0.6, hs * 1.7]);
  else if (kind === "tokin") k.box(head, 0x1a1420, [0, hs * 1.05, hs * 0.2], [hs * 0.4, hs * 0.35, hs * 0.4], [0.3, 0.7, 0]);
  else if (kind === "eboshi") k.cone(head, 0x1a1420, [0, hs * 1.3, -hs * 0.1], [hs * 0.55, hs * 1.1, hs * 0.45], [-0.25, 0, 0]);
  else if (kind === "crown") {
    k.cyl(head, 0xe8c04a, [0, hs * 1.0, 0], [hs * 0.65, hs * 0.25, hs * 0.65], 0, { glow: 0x3a2a00 });
    for (let i = 0; i < 5; i++) k.cone(head, 0xe8c04a, [Math.cos(i * 1.256) * hs * 0.55, hs * 1.25, Math.sin(i * 1.256) * hs * 0.55], [hs * 0.1, hs * 0.3, hs * 0.1], 0, { glow: 0x3a2a00 });
  } else if (kind === "halo") {
    const h = k.part(head, "ring", 0xfff0a0, [0, hs * 1.4, 0], [hs * 0.8, hs * 0.8, 1], [Math.PI / 2, 0, 0], { glow: 0xffd84a });
    h.material.side = 2;
  } else if (kind === "hood") k.sph(head, c, [0, hs * 0.2, -hs * 0.15], [hs * 1.2, hs * 1.15, hs * 1.15]);
  else if (kind === "leaf") k.sph(head, 0x6fbf73, [0, hs * 1.05, 0], [hs * 0.5, hs * 0.1, hs * 0.3], [0, 0.6, 0.3]);
  else if (kind === "candles") for (const x of [-1, 0, 1]) { k.cyl(head, 0xf4f0e0, [x * hs * 0.45, hs * 1.2, 0], [hs * 0.08, hs * 0.5, hs * 0.08]); k.sph(head, 0xffb040, [x * hs * 0.45, hs * 1.5, 0], [hs * 0.1, hs * 0.16, hs * 0.1], 0, { glow: 0xff8a20 }); }
  else if (kind === "tofuhat") k.cone(head, c, [0, hs * 1.15, 0], [hs * 1.4, hs * 0.45, hs * 1.4]);
}

function weapon(k, hand, kind, armLen, o) {
  const g = k.group(hand, [0, -armLen, 0.05], [Math.PI / 2 - 0.2, 0, 0]);
  switch (kind) {
    case "club": k.cyl(g, 0x5a4a44, [0, 0.35, 0], [0.07, 0.8, 0.07]); k.cyl(g, 0x6a5a54, [0, 0.8, 0], [0.13, 0.4, 0.13]);
      for (let i = 0; i < 6; i++) k.cone(g, 0xb8b8c8, [Math.cos(i) * 0.13, 0.7 + (i % 3) * 0.12, Math.sin(i) * 0.13], [0.03, 0.08, 0.03], [0, 0, Math.cos(i) * 1.5]); break;
    case "sword": k.box(g, 0xdfe6f0, [0, 0.55, 0], [0.05, 0.9, 0.015]); k.box(g, 0x2a2a30, [0, 0.08, 0], [0.18, 0.04, 0.06]); break;
    case "sickle": k.cyl(g, 0x6a4a2a, [0, 0.2, 0], [0.03, 0.4, 0.03]); k.box(g, 0xdfe6f0, [0.14, 0.42, 0], [0.3, 0.05, 0.015], [0, 0, -0.3]); break;
    case "staff": k.cyl(g, 0x8a6a3a, [0, 0.3, 0], [0.03, 1.4, 0.03]); k.sph(g, 0xe8c04a, [0, 1.0, 0], [0.07], 0, { glow: 0x3a2a00 }); break;
    case "fan": k.cone(g, 0x3f8f5a, [0, 0.35, 0], [0.28, 0.35, 0.03]); k.cyl(g, 0x8a6a3a, [0, 0.05, 0], [0.02, 0.3, 0.02]); break;
    case "drum": k.cyl(g, 0xc8443a, [0, 0.15, 0.1], [0.2, 0.2, 0.2], [Math.PI / 2, 0, 0]); break;
    case "tray": k.box(g, 0x8a5a3a, [0, 0.12, 0], [0.3, 0.03, 0.3]); k.box(g, 0xf4f0e6, [0, 0.19, 0], [0.16, 0.11, 0.16]); break;
    case "bowl": k.sph(g, 0x6a4a3a, [0, 0.1, 0], [0.18, 0.09, 0.18]); for (let i = 0; i < 5; i++) k.sph(g, 0x8a2a2a, [(i - 2) * 0.04, 0.17, 0], [0.03]); break;
    case "bag": k.sph(g, 0xf2e6c8, [0.1, 0.1, 0], [0.22, 0.2, 0.2]); break;
    case "lantern": k.cyl(g, 0x2a2230, [0, 0.1, 0], [0.015, 0.2, 0.015]); k.sph(g, 0xfff0c0, [0, -0.08, 0], [0.13, 0.17, 0.13], 0, { glow: 0xffa040 }); break;
    case "mallet": k.cyl(g, 0x8a6a3a, [0, 0.25, 0], [0.03, 0.5, 0.03]); k.cyl(g, 0xd9b24a, [0, 0.55, 0], [0.12, 0.22, 0.12], [0, 0, Math.PI / 2], { glow: 0x2a2000 }); break;
    case "spear": k.cyl(g, 0x5a4a3a, [0, 0.5, 0], [0.025, 1.3, 0.025]); k.cone(g, 0xdfe6f0, [0, 1.2, 0], [0.05, 0.22, 0.02]); break;
    case "brush": k.cyl(g, 0x8a6a3a, [0, 0.2, 0], [0.025, 0.4, 0.025]); k.cone(g, 0xf4f0e6, [0, 0.5, 0], [0.09, 0.3, 0.09], [Math.PI, 0, 0]); break;
  }
}

function wings(k, par, p, c, span) {
  for (const x of [-1, 1]) {
    const w = k.group(par, [p[0] + x * 0.15, p[1], p[2]], [0, x * 0.4, 0]);
    k.sph(w, c, [x * span * 0.5, 0.05, 0], [span * 0.55, 0.28, 0.06], [0, 0, x * 0.35], { outline: true });
    for (let i = 0; i < 3; i++) k.sph(w, shade(c, -0.15), [x * span * (0.55 + i * 0.12), -0.15 - i * 0.05, 0], [span * 0.3, 0.12, 0.05], [0, 0, x * (0.6 + i * 0.15)]);
    k.swing(w, "y", 0.35, 5, x > 0 ? 0 : Math.PI);
  }
}

function tail(k, par, p, kind, n, c) {
  for (let t = 0; t < n; t++) {
    const spread = n === 1 ? 0 : (t / (n - 1) - 0.5) * 1.6;
    const g = k.group(par, p, [kind === "bushy" ? 0.15 : 0.5, spread, 0]);
    let pts, r0 = 0.1, r1 = 0.05;
    if (kind === "bushy") { pts = [[0, 0.02, -0.14], [0, 0.12, -0.32], [0, 0.26, -0.46]]; r0 = 0.13; r1 = 0.2; }
    else if (kind === "snake") { pts = []; for (let i = 0; i < 8; i++) pts.push([Math.sin(i * 0.9) * 0.12, i * 0.02, -i * 0.12]); r0 = 0.12; r1 = 0.04; }
    else { pts = []; for (let i = 0; i < 6; i++) pts.push([0, i * 0.1, -i * 0.08]); }
    k.chain(g, c, pts, r0, r1);
    if (kind === "bushy") k.sph(g, 0xf8f4ea, [0, 0.38, -0.56], [0.12]);
    k.swing(g, "y", 0.3, 2.4, t);
  }
}

// ---- 形ごとの作り方 ----
var PLANS = {
  hum: (k, o) => humanoid(k, o),

  // 四つ足
  quad(k, o) {
    const s = o.size ?? 1, c = o.skin, belly = o.belly ?? shade(c, 0.35);
    const bodyLen = (o.long ? 0.95 : 0.7) * s, legH = (o.shortLegs ? 0.22 : 0.4) * s;
    const body = k.group(null);
    k.sph(body, c, [0, legH + 0.28 * s, 0], [0.36 * s, 0.3 * s, bodyLen * 0.62], 0, { outline: true });
    k.sph(body, belly, [0, legH + 0.2 * s, 0.05], [0.28 * s, 0.2 * s, bodyLen * 0.5]);
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const leg = k.group(body, [x * 0.2 * s, legH + 0.1 * s, z * bodyLen * 0.4]);
      k.cyl(leg, c, [0, -legH / 2, 0], [0.08 * s, legH + 0.1 * s, 0.08 * s]);
      k.sph(leg, o.paw ?? shade(c, 0.2), [0, -legH, 0.03], [0.1 * s, 0.07 * s, 0.12 * s]);
      k.swing(leg, "x", 0.12, 3, z > 0 ? 0 : Math.PI);
    }
    if (o.mane) k.sph(body, o.mane, [0, legH + 0.45 * s, bodyLen * 0.35], [0.4 * s, 0.38 * s, 0.3 * s], 0, { outline: true });
    const head = k.group(body, [0, legH + 0.62 * s, bodyLen * 0.5]);
    const hs = 0.3 * s * (o.headK ?? 1);
    k.sph(head, c, [0, 0, 0], [hs, hs * 0.92, hs], 0, { outline: true });
    const sn = o.snout ?? 0.5;
    if (sn > 0) k.sph(head, o.muzzle ?? belly, [0, -hs * 0.25, hs * 0.8], [hs * 0.5, hs * 0.38, hs * sn]);
    k.sph(head, 0x1a1420, [0, -hs * 0.1, hs * (0.8 + sn * 0.9)], [hs * 0.12, hs * 0.1, hs * 0.08]);
    if (o.trunk) k.chain(head, c, [[0, -hs * 0.3, hs * 1.1], [0, -hs * 0.6, hs * 1.3], [0, -hs * 0.9, hs * 1.35]], hs * 0.18, hs * 0.1);
    k.eyes(head, hs * 0.2, hs * 0.78, hs * 0.38, hs * 0.2, o.eyeStyle ?? "round", o.eyeN ?? 2);
    if (o.mouth === "fang") k.mouth(head, -hs * 0.5, hs * 1.05, hs * 0.5, "fang");
    const ear = o.ears ?? "cat";
    if (ear === "cat" || ear === "fox") for (const x of [-1, 1]) k.cone(head, c, [x * hs * 0.55, hs * 0.85, -hs * 0.1], [hs * 0.26, hs * (ear === "fox" ? 0.75 : 0.55), hs * 0.14], [0, 0, -x * 0.3]);
    if (ear === "round") for (const x of [-1, 1]) k.sph(head, c, [x * hs * 0.7, hs * 0.75, -hs * 0.1], [hs * 0.26, hs * 0.26, hs * 0.12]);
    if (ear === "floppy") for (const x of [-1, 1]) k.sph(head, shade(c, -0.2), [x * hs * 0.85, hs * 0.1, -hs * 0.1], [hs * 0.16, hs * 0.45, hs * 0.22], [0, 0, x * 0.3]);
    if (o.horns === "ox") for (const x of [-1, 1]) k.cone(head, 0xf4ead0, [x * hs * 0.95, hs * 0.55, 0], [hs * 0.14, hs * 0.8, hs * 0.14], [0, 0, -x * 1.1]);
    if (o.horns === "antler") for (const x of [-1, 1]) { const a = k.group(head, [x * hs * 0.4, hs * 0.85, 0], [0, 0, -x * 0.4]); k.cyl(a, 0xc8a878, [0, 0.2 * s, 0], [0.03 * s, 0.4 * s, 0.03 * s]); k.cyl(a, 0xc8a878, [x * 0.08 * s, 0.3 * s, 0], [0.025 * s, 0.25 * s, 0.025 * s], [0, 0, -x * 0.8]); }
    if (o.horns === "one") k.horn(head, 0xf4e6c8, [0, hs * 0.95, 0], hs * 0.8, 0.2);
    if (o.eyesMany) for (const x of [-1, 1]) for (const z of [-0.2, 0.15]) { const g = k.group(body, [x * 0.36 * s, legH + 0.32 * s, z * s], [0, x * Math.PI / 2, 0]); k.eyes(g, 0, 0, 0, 0.055 * s, "round", 1); }
    if (o.leaf) k.sph(head, 0x6fbf73, [0, hs * 1.0, 0], [hs * 0.45, hs * 0.08, hs * 0.28], [0, 0.6, 0.3]);
    if (o.hat) hat(k, head, hs, o.hat, o.hatColor ?? 0x2a2230);
    if (o.wings) wings(k, body, [0, legH + 0.45 * s, 0], o.wings, 0.8 * s);
    if (o.flames) for (const x of [-1, 1, 0]) flameBit(k, body, [x * 0.25 * s, legH + 0.5 * s, -bodyLen * 0.3], 0.18 * s, o.flames);
    tail(k, body, [0, legH + 0.35 * s, -bodyLen * 0.55], o.tail ?? "thin", o.tails ?? 1, o.tailColor ?? c);
    if (o.drum) { const d = k.cyl(body, 0xc8443a, [0, legH + 0.25 * s, bodyLen * 0.62], [0.22 * s, 0.18 * s, 0.22 * s], [Math.PI / 2, 0, 0]); k.cyl(d, 0xf4ecd8, [0, 0.52, 0], [0.9, 0.05, 0.9]); }
    if (o.sickles) for (const x of [-1, 1]) k.box(body, 0xdfe6f0, [x * 0.38 * s, legH + 0.25 * s, bodyLen * 0.25], [0.04, 0.05 * s, 0.4 * s], [0, x * 0.4, 0]);
    k.bob(head, 0.02, 2);
    return { body, head, top: legH + 0.9 * s };
  },

  bird(k, o) {
    const s = o.size ?? 1, c = o.skin;
    const body = k.group(null);
    const legs = o.legs ?? 2;
    for (let i = 0; i < legs; i++) {
      const x = (i - (legs - 1) / 2) * 0.15 * s;
      k.cyl(body, 0xe0a030, [x, 0.2 * s, 0], [0.03 * s, 0.4 * s, 0.03 * s]);
      k.box(body, 0xe0a030, [x, 0.02, 0.06 * s], [0.12 * s, 0.03, 0.16 * s]);
    }
    k.sph(body, c, [0, 0.62 * s, 0], [0.34 * s, 0.4 * s, 0.34 * s], [0.2, 0, 0], { outline: true });
    k.sph(body, o.belly ?? shade(c, 0.3), [0, 0.56 * s, 0.14 * s], [0.24 * s, 0.3 * s, 0.22 * s]);
    wings(k, body, [0, 0.72 * s, -0.05 * s], o.wingColor ?? shade(c, -0.1), 0.95 * s);
    k.cone(body, shade(c, -0.2), [0, 0.45 * s, -0.4 * s], [0.18 * s, 0.4 * s, 0.05 * s], [-2.2, 0, 0]);
    const head = k.group(body, [0, 1.05 * s, 0.08 * s]);
    const hs = 0.24 * s;
    if (o.face === "human") { k.sph(head, 0xf1d9c4, [0, 0, 0], [hs], 0, { outline: true }); k.eyes(head, hs * 0.1, hs * 0.85, hs * 0.36, hs * 0.2, "angry"); k.mouth(head, -hs * 0.4, hs * 0.9, hs * 0.4); if (o.hair) hair(k, head, hs, o.hair, o.hairColor ?? 0x1c1820); }
    else if (o.face === "monkey") { k.sph(head, 0x8a5a3a, [0, 0, 0], [hs], 0, { outline: true }); k.sph(head, 0xe8b890, [0, -hs * 0.1, hs * 0.55], [hs * 0.7, hs * 0.65, hs * 0.5]); k.eyes(head, hs * 0.05, hs * 0.95, hs * 0.3, hs * 0.18, "angry"); }
    else {
      k.sph(head, c, [0, 0, 0], [hs], 0, { outline: true });
      k.cone(head, o.beak ?? 0xf2b33a, [0, -hs * 0.1, hs * 1.15], [hs * 0.3, hs * (o.longBeak ? 1.4 : 0.8), hs * 0.25], [Math.PI / 2, 0, 0]);
      k.eyes(head, hs * 0.15, hs * 0.72, hs * 0.45, hs * 0.22, o.eyeStyle ?? "round");
    }
    if (o.crest) for (let i = 0; i < 3; i++) k.cone(head, o.crest, [0, hs * (0.9 + i * 0.1), -hs * 0.3 * i], [hs * 0.12, hs * 0.5, hs * 0.08], [-0.5 - i * 0.3, 0, 0]);
    if (o.flames) flameBit(k, head, [0, hs * 1.2, -hs * 0.2], hs * 0.8, o.flames);
    if (o.snakeTail) tail(k, body, [0, 0.5 * s, -0.3 * s], "snake", 1, 0x5a8a4a);
    k.bob(head, 0.03, 2.6);
    return { body, head, top: 1.3 * s };
  },

  serpent(k, o) {
    const s = o.size ?? 1, c = o.skin, n = o.segments ?? 12;
    const body = k.group(null);
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      pts.push([Math.sin(t * 5.5) * 0.35 * s, 0.14 * s + Math.max(0, (t - 0.55) * 1.8) * s, -0.6 * s + t * 0.9 * s]);
    }
    const segs = k.chain(body, i => i % 2 ? c : shade(c, o.stripe ?? -0.12), pts.reverse(), 0.1 * s, 0.2 * s, { outline: true });
    if (o.legs === "centipede") segs.forEach((sg, i) => { if (i % 1 === 0 && i < n - 1) for (const x of [-1, 1]) k.cyl(body, 0xe0a030, [sg.position.x + x * 0.2 * s, sg.position.y - 0.05, sg.position.z], [0.025 * s, 0.3 * s, 0.025 * s], [0, 0, x * 1.1]); });
    const hp = pts[pts.length - 1];
    const head = k.group(body, [hp[0], hp[1] + 0.12 * s, hp[2] + 0.1 * s]);
    const hs = 0.26 * s;
    if (o.womanTop) {
      const hb = humanoid(k, { build: "slim", noLegs: true, skin: 0xf4e2d0, torsoColor: o.cloth, sleeve: o.cloth, headSize: 0.3, hair: "long", hairColor: 0x1c1820, eyeStyle: "angry", mouth: "fang" });
      hb.body.position.set(hp[0], hp[1] - 0.45, hp[2]);
      return { body, head: hb.head, top: hp[1] + 1.3 };
    }
    k.sph(head, c, [0, 0, 0], [hs * 0.9, hs * 0.75, hs * 1.2], 0, { outline: true });
    k.eyes(head, hs * 0.3, hs * 0.75, hs * 0.45, hs * 0.2, o.eyeStyle ?? "slit", 2, o.eyeColor ?? 0xf2d15c);
    k.mouth(head, -hs * 0.3, hs * 1.1, hs * 0.5, o.mouth ?? "fang");
    if (o.horns) for (const x of [-1, 1]) k.horn(head, o.hornColor ?? 0xe8d8a8, [x * hs * 0.4, hs * 0.6, -hs * 0.3], hs * 0.9, -0.6, -x * 0.3);
    if (o.whiskers) for (const x of [-1, 1]) k.cyl(head, 0xf4e6c8, [x * hs * 0.8, -hs * 0.1, hs * 0.8], [0.015, hs * 1.4, 0.015], [0.3, 0, x * 1.3]);
    if (o.mane) k.sph(head, o.mane, [0, hs * 0.3, -hs * 0.6], [hs * 0.9, hs * 0.7, hs * 0.8]);
    k.bob(head, 0.04, 1.8);
    return { body, head, top: hp[1] + 0.4 * s };
  },

  // 足のない、ゆらめく霊
  ghost(k, o) {
    const s = o.size ?? 1, c = o.skin;
    const body = k.group(null, [0, 0.25 * s, 0]);
    k.bob(body, 0.08, 1.5);
    k.cone(body, c, [0, 0.5 * s, 0], [0.42 * s, 0.9 * s, 0.4 * s], [Math.PI, 0, 0], { alpha: o.alpha ?? 0.85, outline: false });
    k.sph(body, c, [0, 0.9 * s, 0], [0.4 * s, 0.35 * s, 0.38 * s], 0, { alpha: o.alpha ?? 0.85 });
    for (const x of [-1, 1]) {
      const a = k.group(body, [x * 0.38 * s, 0.9 * s, 0.05], [0, 0, x * 0.9]);
      k.cone(a, c, [0, -0.25 * s, 0.1], [0.1 * s, 0.5 * s, 0.1 * s], [Math.PI, 0, 0], { alpha: o.alpha ?? 0.85 });
      k.swing(a, "x", 0.4, 1.8, x);
    }
    const head = k.group(body, [0, 1.3 * s, 0]);
    const hs = 0.3 * s;
    k.sph(head, o.headColor ?? c, [0, 0, 0], [hs], 0, { outline: true, alpha: o.headColor ? 1 : undefined });
    if (o.hair) hair(k, head, hs, o.hair, o.hairColor ?? 0x1c1820);
    face(k, head, hs, { eyeStyle: o.eyeStyle ?? "sleepy", mouth: o.mouth ?? "open", eyeN: o.eyeN, eyeColor: o.eyeColor, noFace: o.noFace, blush: o.blush });
    if (o.hat) hat(k, head, hs, o.hat, o.hatColor ?? 0xf4f4f4);
    if (o.tri) k.cone(head, 0xffffff, [0, hs * 0.85, hs * 0.5], [hs * 0.3, hs * 0.35, 0.02], [0.4, 0, 0]);
    if (o.wisps) for (let i = 0; i < 3; i++) { const w = k.group(body, [Math.cos(i * 2.1) * 0.6 * s, 0.9 * s, Math.sin(i * 2.1) * 0.5 * s]); flameBit(k, w, [0, 0, 0], 0.12 * s, o.wisps); k.bob(w, 0.1, 2 + i); }
    return { body, head, top: 1.8 * s };
  },

  // まるい生きもの（蛙・木霊・ぬりかべの顔など）
  blob(k, o) {
    const s = o.size ?? 1, c = o.skin;
    const body = k.group(null);
    const main = k.sph(body, c, [0, 0.5 * s, 0], [0.55 * s * (o.wide ?? 1), 0.5 * s * (o.tall ?? 1), 0.5 * s], 0, { outline: true, alpha: o.alpha });
    if (o.belly) k.sph(body, o.belly, [0, 0.42 * s, 0.2 * s], [0.4 * s, 0.35 * s, 0.35 * s]);
    const hy = 0.6 * s * (o.tall ?? 1);
    const fz = 0.48 * s;
    if (o.frog) for (const x of [-1, 1]) k.sph(body, c, [x * 0.3 * s, hy + 0.35 * s, 0.1 * s], [0.18 * s]);
    if (o.frog) { const e2 = k.group(body, [0, 0, 0]); for (const x of [-1, 1]) { k.sph(e2, 0xf2d15c, [x * 0.3 * s, hy + 0.38 * s, 0.24 * s], [0.1 * s, 0.1 * s, 0.05 * s]); k.box(e2, 0x1a1420, [x * 0.3 * s, hy + 0.38 * s, 0.28 * s], [0.14 * s, 0.03 * s, 0.02 * s]); } k.box(body, 0x2a1a14, [0, hy - 0.05 * s, fz], [0.7 * s, 0.03 * s, 0.05 * s]); }
    else if (!o.noFace) {
      const fg = k.group(body, [0, hy, 0]);
      k.eyes(fg, 0, fz * 0.95, 0.17 * s, 0.1 * s, o.eyeStyle ?? "round", o.eyeN ?? 2, o.eyeColor);
      if (o.mouth !== "none") k.mouth(fg, -0.18 * s, fz, 0.2 * s, o.mouth ?? "smile");
      if (o.blush) for (const x of [-1, 1]) k.sph(fg, 0xf29aa8, [x * 0.3 * s, -0.1 * s, fz * 0.9], [0.06 * s, 0.04 * s, 0.03 * s]);
    }
    if (o.arms) for (const x of [-1, 1]) { const a = k.group(body, [x * 0.5 * s * (o.wide ?? 1), 0.55 * s, 0], [0, 0, x * 0.8]); k.cyl(a, c, [0, -0.2 * s, 0], [0.07 * s, 0.4 * s, 0.07 * s]); k.swing(a, "x", 0.3, 2, x); }
    if (o.feet) for (const x of [-1, 1]) k.sph(body, shade(c, -0.15), [x * 0.25 * s, 0.06 * s, 0.1 * s], [0.14 * s, 0.07 * s, 0.2 * s]);
    if (o.spots) for (let i = 0; i < 7; i++) k.sph(body, o.spots, [Math.cos(i * 1.3) * 0.4 * s, 0.4 * s + Math.sin(i * 2.1) * 0.25 * s, Math.sin(i * 1.3) * 0.35 * s - 0.05], [0.06 * s]);
    if (o.cap) k.sph(body, o.cap, [0, 0.95 * s * (o.tall ?? 1), 0], [0.7 * s, 0.32 * s, 0.7 * s], 0, { outline: true });
    if (o.leaf) k.sph(body, 0x6fbf73, [0, 1.02 * s * (o.tall ?? 1), 0], [0.2 * s, 0.05 * s, 0.12 * s], [0, 0.5, 0.3]);
    if (o.horns) for (const x of [-1, 1]) k.horn(body, 0xf4e6c8, [x * 0.25 * s, 0.95 * s * (o.tall ?? 1), 0], 0.25 * s, 0, -x * 0.3);
    if (o.hat) hat(k, k.group(body, [0, 0.72 * s * (o.tall ?? 1), 0]), 0.3 * s, o.hat, o.hatColor ?? 0x2a2230);
    k.swing(main, "z", 0.05, 1.8);
    return { body, head: body, top: 1.05 * s * (o.tall ?? 1) };
  },

  // 石・壁・塔など
  stone(k, o) {
    const s = o.size ?? 1, c = o.skin;
    const body = k.group(null);
    let top = 1.2 * s;
    if (o.shape === "wall") { k.box(body, c, [0, 0.7 * s, 0], [1.2 * s, 1.4 * s, 0.4 * s], 0, { outline: true, flat: true }); for (let i = 0; i < 3; i++) k.box(body, shade(c, -0.15), [0, 0.3 * s + i * 0.4 * s, 0.21 * s], [1.2 * s, 0.03, 0.02]); top = 1.4 * s; }
    else if (o.shape === "tablet") { k.box(body, c, [0, 0.65 * s, 0], [0.55 * s, 1.3 * s, 0.25 * s], 0, { outline: true, flat: true }); k.box(body, shade(c, -0.25), [0, 0.02, 0], [0.8 * s, 0.1, 0.5 * s]); top = 1.3 * s; }
    else if (o.shape === "pagoda") { for (let i = 0; i < 4; i++) { k.box(body, c, [0, 0.2 * s + i * 0.32 * s, 0], [0.4 * s - i * 0.05 * s, 0.2 * s, 0.4 * s - i * 0.05 * s], 0, { flat: true }); k.cone(body, shade(c, -0.2), [0, 0.35 * s + i * 0.32 * s, 0], [0.45 * s - i * 0.06 * s, 0.14 * s, 0.45 * s - i * 0.06 * s], [0, Math.PI / 4, 0], { flat: true }); } k.cone(body, 0xd9b24a, [0, 1.5 * s, 0], [0.05 * s, 0.3 * s, 0.05 * s]); top = 1.6 * s; }
    else if (o.shape === "haniwa") { k.cyl(body, c, [0, 0.55 * s, 0], [0.3 * s, 1.1 * s, 0.3 * s], 0, { outline: true }); k.sph(body, c, [0, 1.15 * s, 0], [0.26 * s], 0, { outline: true }); for (const x of [-1, 1]) k.cyl(body, c, [x * 0.35 * s, 0.75 * s, 0], [0.07 * s, 0.4 * s, 0.07 * s], [0, 0, x * 0.8]); for (const [x, y] of [[-0.1, 1.2], [0.1, 1.2], [0, 1.05]]) k.sph(body, 0x2a1a14, [x * s, y * s, 0.24 * s], [0.045 * s, 0.035 * s, 0.03 * s]); top = 1.4 * s; }
    else if (o.shape === "lantern") { k.cyl(body, c, [0, 0.3 * s, 0], [0.12 * s, 0.6 * s, 0.12 * s]); k.box(body, c, [0, 0.72 * s, 0], [0.5 * s, 0.35 * s, 0.5 * s], 0, { flat: true, outline: true }); k.box(body, 0xffd070, [0, 0.72 * s, 0.2 * s], [0.25 * s, 0.2 * s, 0.14 * s], 0, { glow: 0xffa040 }); k.cone(body, shade(c, -0.2), [0, 1.02 * s, 0], [0.45 * s, 0.25 * s, 0.45 * s], [0, Math.PI / 4, 0], { flat: true }); flameBit(k, body, [0, 0.74 * s, 0], 0.1 * s, o.flameColor ?? 0x6ab8ff); top = 1.2 * s; }
    else { const b = k.sph(body, c, [0, 0.55 * s, 0], [0.62 * s, 0.55 * s, 0.5 * s], 0, { outline: true, flat: true }); b.rotation.set(0.2, 0.4, 0.1); for (let i = 0; i < 5; i++) k.sph(body, shade(c, -0.18), [Math.cos(i * 1.7) * 0.5 * s, 0.4 * s + Math.sin(i) * 0.3 * s, Math.sin(i * 1.7) * 0.4 * s], [0.12 * s, 0.08 * s, 0.1 * s], 0, { flat: true }); top = 1.1 * s; }
    const fy = { wall: 0.9, tablet: 0.95, pagoda: 0.55, haniwa: 1.2, lantern: 0.3, boulder: 0.65 }[o.shape ?? "boulder"] * s;
    const fz = { wall: 0.21, tablet: 0.13, pagoda: 0.2, haniwa: 0.3, lantern: 0.12, boulder: 0.52 }[o.shape ?? "boulder"] * s;
    if (!o.noFace && o.shape !== "haniwa") { const f = k.group(body, [0, fy, fz]); k.eyes(f, 0, 0.02, 0.15 * s, 0.08 * s, o.eyeStyle ?? "angry", o.eyeN ?? 2, o.eyeColor); if (o.mouth !== "none") k.mouth(f, -0.14 * s, 0.02, 0.2 * s, o.mouth ?? "smile"); }
    if (o.tears) for (const x of [-1, 1]) k.sph(body, 0x8fd0ff, [x * 0.15 * s, fy - 0.12 * s, fz + 0.02], [0.03 * s, 0.07 * s, 0.03 * s], 0, { glow: 0x2a5a8a });
    if (o.arms) for (const x of [-1, 1]) { const a = k.group(body, [x * 0.55 * s, 0.6 * s, 0], [0, 0, x * 0.5]); k.cyl(a, c, [0, -0.2 * s, 0], [0.09 * s, 0.45 * s, 0.09 * s]); k.swing(a, "x", 0.2, 1.5, x); }
    if (o.feet) for (const x of [-1, 1]) k.box(body, shade(c, -0.2), [x * 0.3 * s, 0.05, 0.1 * s], [0.2 * s, 0.1, 0.3 * s]);
    if (o.aura) { const au = k.part(body, "sph", o.aura, [0, 0.6 * s, 0], [0.9 * s, 0.8 * s, 0.9 * s], 0, { basic: true, alpha: 0.18 }); k.bob(au, 0.05, 1.2); }
    if (o.rope) k.cyl(body, 0xf4ecd8, [0, fy + 0.2 * s, 0], [0.5 * s, 0.06 * s, 0.4 * s]);
    return { body, head: body, top };
  },

  // 付喪神（道具のおばけ）
  object(k, o) {
    const s = o.size ?? 1, c = o.skin;
    const body = k.group(null);
    let fy = 0.7 * s, fz = 0.25 * s, top = 1.3 * s;
    switch (o.thing) {
      case "umbrella": {
        k.cone(body, c, [0, 1.05 * s, 0], [0.75 * s, 0.7 * s, 0.75 * s], 0, { outline: true });
        for (let i = 0; i < 8; i++) k.cyl(body, shade(c, -0.3), [Math.cos(i * 0.785) * 0.35 * s, 0.95 * s, Math.sin(i * 0.785) * 0.35 * s], [0.012, 0.75 * s, 0.012], [Math.sin(i * 0.785) * 1.05, 0, -Math.cos(i * 0.785) * 1.05]);
        k.cyl(body, 0xc9a36b, [0, 0.45 * s, 0], [0.04 * s, 0.8 * s, 0.04 * s]);
        k.box(body, 0x8a5a3a, [0, 0.04, 0.05], [0.18 * s, 0.08, 0.3 * s]);
        fy = 1.05 * s; fz = 0.4 * s; top = 1.5 * s;
        k.eyes(body, fy, fz, 0, 0.12 * s, "round", 1);
        const tongue = k.sph(body, 0xe55a78, [0, fy - 0.2 * s, fz + 0.02], [0.08 * s, 0.14 * s, 0.03 * s]); k.swing(tongue, "z", 0.3, 4);
        return { body, head: body, top };
      }
      case "lantern": {
        k.sph(body, 0xfff2d8, [0, 0.8 * s, 0], [0.42 * s, 0.55 * s, 0.42 * s], 0, { outline: true, glow: 0x5a3a10 });
        for (let i = 0; i < 5; i++) k.cyl(body, 0xc8443a, [0, 0.45 * s + i * 0.17 * s, 0], [0.43 * s * Math.sin(0.5 + i * 0.5), 0.02, 0.43 * s * Math.sin(0.5 + i * 0.5)]);
        k.cyl(body, 0x2a2230, [0, 1.35 * s, 0], [0.22 * s, 0.1 * s, 0.22 * s]); k.cyl(body, 0x2a2230, [0, 0.27 * s, 0], [0.24 * s, 0.1 * s, 0.24 * s]);
        fy = 0.85 * s; fz = 0.38 * s; top = 1.45 * s;
        k.eyes(body, fy, fz, 0.15 * s, 0.09 * s, "angry");
        const t = k.sph(body, 0xe55a78, [0, fy - 0.25 * s, fz + 0.05], [0.07 * s, 0.2 * s, 0.03 * s]); k.swing(t, "z", 0.3, 4);
        return { body, head: body, top };
      }
      case "sandal": {
        k.box(body, c, [0, 0.12 * s, 0], [0.5 * s, 0.14 * s, 1.0 * s], 0, { outline: true });
        k.cyl(body, 0xc8443a, [0, 0.3 * s, 0.1 * s], [0.25 * s, 0.03, 0.25 * s], [Math.PI / 2, 0, 0]);
        for (const x of [-1, 1]) { const l = k.group(body, [x * 0.15 * s, 0.05, 0]); k.cyl(l, 0x6a4a3a, [0, -0.02, 0], [0.03, 0.1, 0.03]); }
        fy = 0.45 * s; fz = 0.2 * s; top = 0.8 * s;
        const f = k.group(body, [0, 0.4 * s, 0.3 * s]); k.eyes(f, 0, 0, 0.12 * s, 0.1 * s, "round", 1); k.mouth(f, -0.12 * s, 0, 0.18 * s, "open");
        return { body, head: body, top };
      }
      case "koto": {
        k.box(body, c, [0, 0.35 * s, 0], [0.4 * s, 0.15 * s, 1.3 * s], [0.4, 0, 0], { outline: true });
        for (let i = 0; i < 6; i++) k.cyl(body, 0xf4ecd8, [(i - 2.5) * 0.05 * s, 0.45 * s, 0], [0.006, 1.2 * s, 0.006], [Math.PI / 2 + 0.4, 0, 0]);
        const hb = humanoid(k, { build: "child", skin: 0xf4e2d0, cloth: o.cloth ?? 0x7a3a6a, robe: true, hair: "long", headSize: 0.3, eyeStyle: "sleepy" });
        hb.body.position.set(0, 0.2 * s, -0.4 * s); hb.body.scale.setScalar(0.8 * s);
        return { body, head: hb.head, top: 1.4 * s };
      }
      case "biwa": case "shamisen": {
        const n = o.thing === "biwa";
        k.sph(body, c, [0, 0.55 * s, 0], [n ? 0.45 * s : 0.35 * s, n ? 0.55 * s : 0.35 * s, 0.14 * s], 0, { outline: true });
        k.box(body, shade(c, -0.3), [0, 1.05 * s, 0], [0.08 * s, n ? 0.5 * s : 0.9 * s, 0.06 * s]);
        for (let i = 0; i < 3; i++) k.cyl(body, 0xf4ecd8, [(i - 1) * 0.04 * s, 0.9 * s, 0.13 * s], [0.005, 0.9 * s, 0.005]);
        for (const x of [-1, 1]) { const a = k.group(body, [x * 0.4 * s, 0.6 * s, 0], [0, 0, x * 0.7]); k.cyl(a, 0xf4e2d0, [0, -0.2 * s, 0], [0.04 * s, 0.4 * s, 0.04 * s]); k.swing(a, "x", 0.4, 3, x); }
        const f = k.group(body, [0, 0.62 * s, 0.14 * s]); k.eyes(f, 0.05 * s, 0, 0.12 * s, 0.08 * s, n ? "sleepy" : "angry"); k.mouth(f, -0.12 * s, 0, 0.2 * s, "open");
        if (o.beard) k.cone(body, 0xf4f4f4, [0, 0.35 * s, 0.14 * s], [0.12 * s, 0.3 * s, 0.05 * s], [Math.PI, 0, 0]);
        return { body, head: body, top: 1.45 * s };
      }
      case "pottery": {
        k.sph(body, c, [0, 0.5 * s, 0], [0.4 * s, 0.45 * s, 0.35 * s], 0, { outline: true }); // 胴の甕
        for (let i = 0; i < 4; i++) k.cyl(body, 0x2a5aa8, [0, 0.35 * s + i * 0.1 * s, 0], [0.41 * s * Math.sin(0.9 + i * 0.35), 0.02, 0.36 * s * Math.sin(0.9 + i * 0.35)]);
        for (const x of [-1, 1]) { k.cyl(body, 0xf4f0e6, [x * 0.18 * s, 0.1, 0], [0.09 * s, 0.25 * s, 0.09 * s]); const a = k.group(body, [x * 0.42 * s, 0.7 * s, 0], [0, 0, x * 0.7]); k.cyl(a, 0xf4f0e6, [0, -0.2 * s, 0], [0.07 * s, 0.35 * s, 0.07 * s]); k.sph(a, 0x2a5aa8, [0, -0.4 * s, 0], [0.09 * s]); k.swing(a, "x", 0.3, 2, x); }
        const head = k.group(body, [0, 1.1 * s, 0]);
        k.sph(head, 0xf4f0e6, [0, 0, 0], [0.25 * s, 0.22 * s, 0.24 * s], 0, { outline: true });
        k.cyl(head, 0x2a5aa8, [0, 0.2 * s, 0], [0.22 * s, 0.08 * s, 0.22 * s]);
        k.eyes(head, 0.02 * s, 0.22 * s, 0.09 * s, 0.05 * s, "angry"); k.mouth(head, -0.1 * s, 0.23 * s, 0.12 * s);
        return { body, head, top: 1.35 * s };
      }
      case "kettle": {
        k.sph(body, c, [0, 0.45 * s, 0], [0.5 * s, 0.38 * s, 0.5 * s], 0, { outline: true });
        k.cyl(body, shade(c, -0.2), [0, 0.8 * s, 0], [0.3 * s, 0.1 * s, 0.3 * s]);
        k.cyl(body, shade(c, -0.2), [0, 0.1, 0], [0.35 * s, 0.1 * s, 0.35 * s]);
        for (let i = 0; i < 3; i++) { const st = k.sph(body, 0xf4f4f4, [Math.sin(i) * 0.1, 1.0 * s + i * 0.15 * s, 0], [0.1 * s + i * 0.04 * s], 0, { basic: true, alpha: 0.45 }); k.bob(st, 0.06, 2 + i); }
        const f = k.group(body, [0, 0.5 * s, 0.46 * s]); k.eyes(f, 0.05 * s, 0, 0.14 * s, 0.08 * s, "round"); k.mouth(f, -0.12 * s, 0, 0.2 * s, "open");
        return { body, head: body, top: 1.2 * s };
      }
      case "whisk": case "mokugyo": {
        if (o.thing === "whisk") {
          k.cyl(body, 0x6a4a2a, [0, 0.8 * s, 0], [0.05 * s, 0.7 * s, 0.05 * s]);
          const hair = k.group(body, [0, 0.45 * s, 0]); for (let i = 0; i < 9; i++) k.cyl(hair, 0xf4f0e6, [Math.cos(i) * 0.08 * s, -0.15 * s, Math.sin(i) * 0.08 * s], [0.02 * s, 0.6 * s, 0.02 * s], [Math.sin(i) * 0.15, 0, Math.cos(i) * 0.15]); k.swing(hair, "z", 0.2, 2);
          const f = k.group(body, [0, 1.1 * s, 0]); k.sph(f, 0x8a6a3a, [0, 0, 0], [0.18 * s], 0, { outline: true }); k.eyes(f, 0.02 * s, 0.17 * s, 0.07 * s, 0.05 * s, "sleepy"); k.mouth(f, -0.07 * s, 0.17 * s, 0.1 * s);
          return { body, head: f, top: 1.3 * s };
        }
        k.sph(body, c, [0, 0.45 * s, 0], [0.55 * s, 0.42 * s, 0.45 * s], 0, { outline: true });
        k.box(body, 0x2a1a14, [0, 0.38 * s, 0.43 * s], [0.6 * s, 0.04 * s, 0.04 * s]);
        for (let i = 0; i < 12; i++) k.sph(body, 0x6a3a2a, [Math.cos(i * 0.52) * 0.58 * s, 0.9 * s, Math.sin(i * 0.52) * 0.45 * s], [0.06 * s]);
        const f = k.group(body, [0, 0.62 * s, 0.4 * s]); k.eyes(f, 0, 0, 0.16 * s, 0.09 * s, "angry"); k.sph(body, 0xf4e2d0, [0, 1.0 * s, 0], [0.24 * s], 0, { outline: true });
        return { body, head: body, top: 1.25 * s };
      }
      case "mask": {
        const m = k.sph(body, c, [0, 0.85 * s, 0], [0.4 * s, 0.5 * s, 0.18 * s], 0, { outline: true });
        k.bob(body, 0.08, 1.4);
        const f = k.group(body, [0, 0.9 * s, 0.17 * s]); k.eyes(f, 0.1 * s, 0, 0.14 * s, 0.07 * s, o.eyeStyle ?? "slit", 2, 0xf2d15c); k.mouth(f, -0.2 * s, 0, 0.18 * s, "fang");
        if (o.horns) for (const x of [-1, 1]) k.horn(body, 0xf4e6c8, [x * 0.28 * s, 1.3 * s, 0], 0.3 * s, 0, -x * 0.4);
        for (const x of [-1, 1]) k.box(body, 0xc8443a, [x * 0.45 * s, 0.85 * s, -0.05], [0.25 * s, 0.03, 0.03], [0, 0, x * 0.3]);
        return { body, head: body, top: 1.4 * s };
      }
      case "cart": case "wheel": {
        const w = k.group(body, [0, 0.5 * s, 0], [0, Math.PI / 2, 0]);
        const rim = k.part(w, "ring", c, [0, 0, 0], [0.5 * s, 0.5 * s, 1], 0, { outline: false }); rim.material.side = 2;
        k.cyl(w, c, [0, 0, 0], [0.48 * s, 0.08 * s, 0.48 * s], [Math.PI / 2, 0, 0], { alpha: 0.35 });
        for (let i = 0; i < 8; i++) k.box(w, shade(c, -0.2), [0, 0, 0], [0.04 * s, 0.95 * s, 0.04 * s], [0, 0, i * 0.39]);
        k.swing(w, "z", 6.28, 0.6);
        if (o.thing === "cart") { k.box(body, 0x3a2a30, [-0.4 * s, 0.85 * s, 0], [0.9 * s, 0.7 * s, 0.9 * s], 0, { outline: true }); k.cone(body, 0x2a2230, [-0.4 * s, 1.35 * s, 0], [0.7 * s, 0.35 * s, 0.7 * s], [0, Math.PI / 4, 0]); const f = k.group(body, [-0.4 * s, 0.85 * s, 0.46 * s]); k.sph(f, 0xf4e2d0, [0, 0, 0], [0.3 * s, 0.35 * s, 0.1 * s]); k.eyes(f, 0.05 * s, 0.08 * s, 0.12 * s, 0.07 * s, "angry"); k.mouth(f, -0.15 * s, 0.09 * s, 0.15 * s, "fang"); return { body, head: f, top: 1.6 * s }; }
        const hd = k.group(body, [0, 0.5 * s, 0.05]); k.sph(hd, o.faceColor ?? 0xe8b890, [0, 0, 0], [0.24 * s], 0, { outline: true }); k.eyes(hd, 0.04 * s, 0.22 * s, 0.09 * s, 0.06 * s, "angry"); k.mouth(hd, -0.1 * s, 0.22 * s, 0.14 * s, "fang");
        for (let i = 0; i < 6; i++) flameBit(k, body, [0, 0.5 * s + Math.cos(i) * 0.5 * s, Math.sin(i) * 0.5 * s], 0.12 * s, o.flames ?? 0xff7a3d);
        return { body, head: hd, top: 1.1 * s };
      }
      case "pillar": {
        k.cyl(body, c, [0, 0.8 * s, 0], [0.28 * s, 1.6 * s, 0.28 * s], 0, { outline: true, flat: true });
        for (let i = 0; i < 4; i++) k.box(body, shade(c, -0.25), [0, 0.3 * s + i * 0.35 * s, 0.26 * s], [0.02, 0.2 * s, 0.03], [0, 0, 0.4]);
        const f = k.group(body, [0, 1.1 * s, 0.27 * s]); k.eyes(f, 0, 0, 0.1 * s, 0.07 * s, "angry"); k.mouth(f, -0.15 * s, 0, 0.14 * s, "open");
        return { body, head: body, top: 1.65 * s };
      }
      case "shoji": {
        k.box(body, 0xf4ecd8, [0, 0.75 * s, 0], [1.1 * s, 1.4 * s, 0.08 * s], 0, { outline: true });
        for (let i = 0; i < 4; i++) k.box(body, 0x6a4a3a, [0, 0.1 * s + i * 0.44 * s, 0.05], [1.12 * s, 0.03, 0.02]);
        for (let i = 0; i < 3; i++) k.box(body, 0x6a4a3a, [(i - 1) * 0.37 * s, 0.75 * s, 0.05], [0.03, 1.4 * s, 0.02]);
        for (let i = 0; i < 6; i++) { const e = k.group(body, [((i % 3) - 1) * 0.37 * s + 0.18 * s, 0.35 * s + Math.floor(i / 3) * 0.6 * s, 0.06]); k.eyes(e, 0, 0, 0, 0.08 * s, "round", 1); }
        return { body, head: body, top: 1.45 * s };
      }
      case "cloth": {
        // 空を泳ぐ長い布：先頭（顔）から後ろへ波打って伸びる
        const n = 12, seg = [];
        let prev = k.group(body, [0, 1.2 * s, 0.45 * s], [-0.25, 0, 0]);
        const head = prev;
        k.box(head, c, [0, 0, 0], [0.5 * s, 0.34 * s, 0.03 * s], 0, { outline: true });
        k.eyes(head, 0.04 * s, 0.03 * s, 0.11 * s, 0.06 * s, "round", 2);
        for (let i = 0; i < n; i++) {
          const g = k.group(prev, [0, -0.17 * s, -0.02 * s], [0.28 - i * 0.012, 0, 0]);
          k.box(g, i % 2 ? c : shade(c, -0.06), [0, -0.09 * s, 0], [0.5 * s * (1 - i * 0.02), 0.2 * s, 0.025 * s], 0, { outline: true });
          k.swing(g, "x", 0.16, 2.6, i * 0.55);
          seg.push(g); prev = g;
        }
        for (const x of [-1, 1]) { const a = k.group(head, [x * 0.25 * s, -0.14 * s, 0], [0, 0, x * 0.9]); k.box(a, c, [0, -0.15 * s, 0], [0.12 * s, 0.3 * s, 0.02 * s]); k.swing(a, "x", 0.4, 3, x); }
        return { body, head, top: 1.45 * s };
      }
      case "cartLetters": {
        k.box(body, 0x8a3a2a, [0, 0.45 * s, 0], [0.8 * s, 0.35 * s, 0.6 * s], 0, { outline: true });
        for (const x of [-1, 1]) { const w = k.part(body, "ring", 0x3a2a22, [x * 0.42 * s, 0.25 * s, 0], [0.25 * s, 0.25 * s, 1], [0, Math.PI / 2, 0]); w.material.side = 2; }
        for (let i = 0; i < 5; i++) { const l = k.box(body, 0xf4f0e6, [(i - 2) * 0.15 * s, 0.75 * s, 0], [0.12 * s, 0.25 * s, 0.01], [0, 0, (i - 2) * 0.2]); k.bob(l, 0.05, 2 + i); }
        const hb = humanoid(k, { build: "slim", skin: 0xf4e2d0, robe: true, cloth: o.cloth ?? 0xd48ac0, hair: "long", headSize: 0.28, eyeStyle: "sleepy", blush: true });
        hb.body.position.set(0, 0.45 * s, -0.5 * s); hb.body.scale.setScalar(0.85 * s);
        return { body, head: hb.head, top: 1.6 * s };
      }
    }
    return { body, head: body, top };
  },

  flame(k, o) {
    const s = o.size ?? 1, c = o.skin;
    const body = k.group(null, [0, 0.4 * s, 0]);
    k.bob(body, 0.12, 1.3);
    flameBit(k, body, [0, 0.35 * s, 0], 0.45 * s, c, true);
    const f = k.group(body, [0, 0.35 * s, 0.4 * s]);
    k.eyes(f, 0.05 * s, 0, 0.14 * s, 0.09 * s, o.eyeStyle ?? "angry", o.eyeN ?? 2);
    if (o.mouth !== "none") k.mouth(f, -0.13 * s, 0, 0.18 * s, o.mouth ?? "open");
    if (o.lantern) { const l = k.group(body, [0, -0.25 * s, 0]); k.cyl(l, 0x2a2230, [0, 0, 0], [0.2 * s, 0.1 * s, 0.2 * s]); }
    if (o.foxFace) for (const x of [-1, 1]) k.cone(body, c, [x * 0.2 * s, 0.75 * s, 0], [0.1 * s, 0.25 * s, 0.06 * s], [0, 0, -x * 0.3], { glow: shade(c, -0.4) });
    if (o.orbs) for (let i = 0; i < o.orbs; i++) { const w = k.group(body, [Math.cos(i * 2.1) * 0.6 * s, 0.1 * s + (i % 2) * 0.3 * s, Math.sin(i * 2.1) * 0.5 * s]); flameBit(k, w, [0, 0, 0], 0.12 * s, c); k.bob(w, 0.1, 2 + i); }
    return { body, head: f, top: 1.4 * s };
  },

  critter(k, o) {
    const s = o.size ?? 1, c = o.skin;
    const body = k.group(null);
    switch (o.kind) {
      case "turtle": {
        k.sph(body, o.shell ?? 0x4a6a3a, [0, 0.4 * s, 0], [0.6 * s, 0.35 * s, 0.7 * s], 0, { outline: true, flat: true });
        for (let i = 0; i < 6; i++) k.sph(body, shade(o.shell ?? 0x4a6a3a, 0.2), [Math.cos(i) * 0.3 * s, 0.62 * s, Math.sin(i) * 0.35 * s], [0.15 * s, 0.06 * s, 0.15 * s], 0, { flat: true });
        for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) k.sph(body, c, [x * 0.45 * s, 0.15 * s, z * 0.45 * s], [0.14 * s, 0.12 * s, 0.18 * s]);
        const hd = k.group(body, [0, 0.45 * s, 0.75 * s]); k.sph(hd, c, [0, 0, 0], [0.22 * s, 0.2 * s, 0.25 * s], 0, { outline: true }); k.eyes(hd, 0.05 * s, 0.2 * s, 0.1 * s, 0.05 * s, o.eyeStyle ?? "sleepy"); k.mouth(hd, -0.08 * s, 0.24 * s, 0.1 * s);
        if (o.mossTail) { const t = k.group(body, [0, 0.35 * s, -0.7 * s]); for (let i = 0; i < 5; i++) k.cone(t, 0xa8d8a8, [(i - 2) * 0.08 * s, 0, -0.2 * s], [0.06 * s, 0.5 * s, 0.03 * s], [-1.4, 0, (i - 2) * 0.2]); k.swing(t, "y", 0.3, 1.5); }
        if (o.hat) hat(k, hd, 0.22 * s, o.hat, o.hatColor);
        return { body, head: hd, top: 0.9 * s };
      }
      case "crab": {
        k.sph(body, c, [0, 0.45 * s, 0], [0.55 * s, 0.3 * s, 0.4 * s], 0, { outline: true, flat: true });
        for (let i = 0; i < 3; i++) for (const x of [-1, 1]) k.cyl(body, c, [x * 0.55 * s, 0.25 * s, (i - 1) * 0.2 * s], [0.04 * s, 0.4 * s, 0.04 * s], [0, 0, x * 0.9]);
        for (const x of [-1, 1]) { const cl = k.group(body, [x * 0.55 * s, 0.6 * s, 0.3 * s]); k.sph(cl, c, [0, 0, 0], [0.18 * s, 0.13 * s, 0.1 * s], 0, { outline: true }); k.cone(cl, c, [x * 0.05, 0.15 * s, 0], [0.06 * s, 0.25 * s, 0.05 * s], [0, 0, -x * 0.4]); k.swing(cl, "z", 0.3, 3, x); }
        const f = k.group(body, [0, 0.8 * s, 0.1 * s]);
        if (o.monk) { k.sph(f, 0xe8b890, [0, 0.1 * s, 0], [0.22 * s], 0, { outline: true }); k.eyes(f, 0.12 * s, 0.2 * s, 0.08 * s, 0.05 * s, "angry"); k.mouth(f, 0, 0.21 * s, 0.1 * s); }
        else for (const x of [-1, 1]) { const st = k.group(f, [x * 0.1 * s, 0, 0]); k.cyl(st, c, [0, 0, 0], [0.02 * s, 0.2 * s, 0.02 * s]); k.eyes(st, 0.12 * s, 0.02, 0, 0.05 * s, "round", 1); }
        return { body, head: f, top: 1.1 * s };
      }
      case "shell": {
        const sh = k.cone(body, c, [0, 0.55 * s, -0.05 * s], [0.4 * s, 0.9 * s, 0.4 * s], 0, { outline: true, flat: true });
        for (let i = 0; i < 4; i++) k.cone(body, shade(c, -0.2), [Math.cos(i * 1.57) * 0.3 * s, 0.4 * s, Math.sin(i * 1.57) * 0.3 * s], [0.07 * s, 0.25 * s, 0.07 * s], [Math.sin(i * 1.57) * 1.2, 0, -Math.cos(i * 1.57) * 1.2]);
        const f = k.group(body, [0, 0.35 * s, 0.28 * s]); k.sph(f, 0xa8c46a, [0, 0, 0], [0.22 * s, 0.25 * s, 0.14 * s], 0, { outline: true }); k.eyes(f, 0.05 * s, 0.13 * s, 0.09 * s, 0.05 * s, "angry"); k.mouth(f, -0.1 * s, 0.13 * s, 0.1 * s, "fang");
        return { body, head: f, top: 1.1 * s };
      }
      case "catfish": case "fish": {
        k.sph(body, c, [0, 0.5 * s, 0], [0.35 * s, 0.32 * s, 0.75 * s], 0, { outline: true });
        k.sph(body, o.belly ?? shade(c, 0.35), [0, 0.38 * s, 0.1], [0.28 * s, 0.18 * s, 0.6 * s]);
        const t = k.group(body, [0, 0.55 * s, -0.7 * s]); k.cone(t, shade(c, -0.1), [0, 0, -0.15 * s], [0.3 * s, 0.35 * s, 0.05 * s], [-Math.PI / 2, 0, 0]); k.swing(t, "y", 0.4, 3);
        k.eyes(body, 0.62 * s, 0.6 * s, 0.2 * s, 0.07 * s, "round");
        k.mouth(body, 0.42 * s, 0.72 * s, 0.35 * s, "smile");
        if (o.kind === "catfish") for (const x of [-1, 1]) { const w = k.cyl(body, 0x2a2a30, [x * 0.3 * s, 0.45 * s, 0.7 * s], [0.02 * s, 0.6 * s, 0.02 * s], [0.4, 0, x * 1.2]); k.swing(w, "z", 0.2, 2, x); }
        if (o.monkHead) { const hb = k.group(body, [0, 0.95 * s, 0.1 * s]); k.sph(hb, 0xe8b890, [0, 0, 0], [0.24 * s], 0, { outline: true }); k.eyes(hb, 0.02, 0.22 * s, 0.09 * s, 0.05 * s, "angry"); k.mouth(hb, -0.1 * s, 0.22 * s, 0.1 * s); for (const x of [-1, 1]) k.cyl(body, 0xe8b890, [x * 0.35 * s, 0.75 * s, 0.1 * s], [0.06 * s, 0.4 * s, 0.06 * s], [0, 0, x * 0.7]); return { body, head: hb, top: 1.25 * s }; }
        for (const x of [-1, 1]) k.cone(body, shade(c, -0.1), [x * 0.3 * s, 0.35 * s, 0.1 * s], [0.12 * s, 0.25 * s, 0.03 * s], [0, 0, x * 2.3]);
        return { body, head: body, top: 0.9 * s };
      }
      case "spider": {
        k.sph(body, c, [0, 0.55 * s, -0.3 * s], [0.45 * s, 0.4 * s, 0.5 * s], 0, { outline: true });
        if (o.pattern) k.sph(body, o.pattern, [0, 0.8 * s, -0.4 * s], [0.25 * s, 0.1 * s, 0.25 * s]);
        k.sph(body, c, [0, 0.5 * s, 0.2 * s], [0.28 * s, 0.25 * s, 0.28 * s], 0, { outline: true });
        for (let i = 0; i < 4; i++) for (const x of [-1, 1]) { const l = k.group(body, [x * 0.2 * s, 0.5 * s, 0.2 * s - i * 0.13 * s], [0, x * (0.4 - i * 0.3), 0]); k.cyl(l, shade(c, -0.1), [x * 0.35 * s, 0.1 * s, 0], [0.035 * s, 0.7 * s, 0.035 * s], [0, 0, x * 1.1]); k.cyl(l, shade(c, -0.1), [x * 0.72 * s, -0.2 * s, 0], [0.03 * s, 0.6 * s, 0.03 * s], [0, 0, -x * 0.5]); k.swing(l, "y", 0.15, 4, i + x); }
        if (o.womanTop || o.bullHead) {
          const hb = humanoid(k, o.bullHead ? { build: "bulky", noLegs: true, skin: c, head: "bull", headSize: 0.36, eyeStyle: "angry", mouth: "fang", eyeColor: 0xf2d15c } : { build: "slim", noLegs: true, skin: 0xf4e2d0, torsoColor: o.cloth ?? 0x7a3a6a, sleeve: o.cloth ?? 0x7a3a6a, hair: "long", headSize: 0.3, eyeStyle: "angry", blush: true });
          hb.body.position.set(0, 0.2 * s, 0.25 * s);
          return { body, head: hb.head, top: 1.6 * s };
        }
        const f = k.group(body, [0, 0.55 * s, 0.45 * s]); k.eyes(f, 0.05 * s, 0, 0.1 * s, 0.05 * s, "round", 3, 0xff4a4a); k.mouth(f, -0.1 * s, 0.02, 0.15 * s, "fang");
        return { body, head: f, top: 1.0 * s };
      }
      case "lizard": {
        k.sph(body, c, [0, 0.25 * s, 0], [0.3 * s, 0.18 * s, 0.6 * s], 0, { outline: true });
        for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) k.cyl(body, c, [x * 0.35 * s, 0.12 * s, z * 0.3 * s], [0.05 * s, 0.35 * s, 0.05 * s], [0, 0, x * 1.2]);
        const hd = k.group(body, [0, 0.35 * s, 0.6 * s]); k.sph(hd, c, [0, 0, 0], [0.22 * s, 0.15 * s, 0.28 * s], 0, { outline: true }); k.eyes(hd, 0.08 * s, 0.12 * s, 0.14 * s, 0.07 * s, "slit", 2, 0xf2d15c);
        tail(k, body, [0, 0.25 * s, -0.55 * s], "snake", 1, c);
        return { body, head: hd, top: 0.7 * s };
      }
      case "mushroom": {
        k.cyl(body, 0xf4ecd8, [0, 0.4 * s, 0], [0.22 * s, 0.8 * s, 0.22 * s], 0, { outline: true });
        k.sph(body, c, [0, 0.95 * s, 0], [0.65 * s, 0.35 * s, 0.65 * s], 0, { outline: true });
        const f = k.group(body, [0, 0.45 * s, 0.22 * s]); k.eyes(f, 0.05 * s, 0, 0.08 * s, 0.05 * s, "sleepy"); k.mouth(f, -0.08 * s, 0, 0.1 * s);
        for (let i = 0; i < 4; i++) k.sph(body, 0xfff0c0, [Math.cos(i * 1.6) * 0.4 * s, 1.1 * s, Math.sin(i * 1.6) * 0.4 * s], [0.07 * s], 0, { glow: 0x6a5a20 });
        return { body, head: f, top: 1.35 * s };
      }
      case "skeleton": {
        k.cyl(body, 0xeee8d8, [0, 0.65 * s, 0], [0.05 * s, 0.7 * s, 0.05 * s]);
        for (let i = 0; i < 4; i++) k.cyl(body, 0xeee8d8, [0, 0.55 * s + i * 0.1 * s, 0], [0.22 * s - i * 0.02 * s, 0.03 * s, 0.14 * s]);
        for (const x of [-1, 1]) { k.cyl(body, 0xeee8d8, [x * 0.12 * s, 0.25 * s, 0], [0.035 * s, 0.5 * s, 0.035 * s]); const a = k.group(body, [x * 0.24 * s, 0.95 * s, 0], [0, 0, x * 0.5]); k.cyl(a, 0xeee8d8, [0, -0.25 * s, 0], [0.03 * s, 0.5 * s, 0.03 * s]); k.swing(a, "x", 0.5, 3, x); }
        const hd = k.group(body, [0, 1.2 * s, 0]); k.sph(hd, 0xeee8d8, [0, 0, 0], [0.24 * s, 0.26 * s, 0.24 * s], 0, { outline: true });
        for (const x of [-1, 1]) k.sph(hd, 0x1a1420, [x * 0.09 * s, 0.02, 0.19 * s], [0.06 * s, 0.07 * s, 0.04 * s]);
        k.eyes(hd, 0.02, 0.23 * s, 0.09 * s, 0.025 * s, "glow");
        if (o.hair) hair(k, hd, 0.24 * s, o.hair, o.hairColor ?? 0x1c1820);
        if (o.shroud) k.cone(body, o.shroud, [0, 0.55 * s, -0.05], [0.4 * s, 1.0 * s, 0.3 * s], 0, { alpha: 0.6 });
        if (o.bucket) k.cyl(body, 0x6a4a3a, [0, 0.1 * s, 0], [0.35 * s, 0.25 * s, 0.35 * s], 0, { outline: true });
        return { body, head: hd, top: 1.5 * s };
      }
      case "frog": {
        const r = PLANS.blob(k, { ...o, frog: true, belly: o.belly ?? 0xc8b87a, feet: true, wide: 1.25, tall: 0.8, spots: o.spots ?? shade(c, -0.2) });
        return r;
      }
    }
    return { body, head: body, top: 1 };
  },
};

// 小さな炎（鬼火・狐火など）
function flameBit(k, par, p, r, c, big = false) {
  const g = k.group(par, p);
  k.sph(g, c, [0, 0, 0], [r, r * 1.1, r], 0, { glow: shade(c, -0.35), alpha: 0.92 });
  k.cone(g, c, [0, r * 1.2, 0], [r * 0.75, r * 1.6, r * 0.75], 0, { glow: shade(c, -0.35), alpha: 0.85 });
  k.sph(g, 0xffffff, [0, -r * 0.1, r * 0.25], [r * 0.55], 0, { basic: true, alpha: 0.35 });
  k.anim.push({ obj: g, flicker: true, phase: k.rnd() * 6, speed: big ? 7 : 11 });
  return g;
}

// ---- 一族ごとの形 ----
// [形, 設定]。色の "@" は種族色、"@d" は暗め、"@l" は明るめ。
var FAMILY_MODEL = {
  // 猛
  茨木童子: ["hum", { build: "bulky", skin: 0xd9483b, horns: 1, hair: "wild", hairColor: 0xe8e0d0, weapon: "sword", pelt: 0xe0a030, eyeStyle: "angry", mouth: "fang" }],
  星熊童子: ["hum", { build: "bulky", skin: 0x3b6fd9, horns: 2, hair: "wild", hairColor: 0x1c1820, weapon: "club", pelt: 0xe0a030, eyeStyle: "angry", mouth: "fang" }],
  金熊童子: ["hum", { build: "fat", skin: 0xd9b24a, horns: 2, hair: "wild", hairColor: 0x3a2a1a, weapon: "mallet", pelt: 0x6a4a2a, eyeStyle: "angry", mouth: "fang" }],
  虎熊童子: ["hum", { build: "bulky", skin: 0xe07a2a, horns: 2, hornLen: 0.9, ears: "round", weapon: "club", pelt: 0xf2d15c, tail: "thin", eyeStyle: "angry", mouth: "fang" }],
  熊童子: ["hum", { build: "fat", skin: 0x7a4a2a, ears: "round", horns: 1, weapon: "club", pelt: 0xd9b24a, eyeStyle: "angry", mouth: "fang" }],
  牛頭: ["hum", { build: "bulky", skin: 0x6a4a3a, head: "bull", weapon: "spear", pelt: 0x3a3a48, eyeStyle: "angry", eyeColor: 0xff6a4a }],
  馬頭: ["hum", { build: "bulky", skin: 0x8a6a4a, head: "horse", weapon: "spear", pelt: 0x3a3a48, eyeStyle: "angry" }],
  羅刹: ["hum", { build: "slim", skin: 0x7a2a3a, horns: 2, hornLen: 1.0, hair: "wild", hairColor: 0xd9483b, weapon: "sword", eyeStyle: "angry", mouth: "fang", eyeColor: 0xffe060 }],
  夜叉: ["hum", { build: "slim", skin: 0x4a7a6a, horns: 2, hair: "wild", hairColor: 0x2a1a3a, weapon: "spear", arms: 4, eyeStyle: "angry", mouth: "fang" }],
  悪路王: ["hum", { build: "bulky", skin: 0x5a3a2a, horns: 2, hat: "crown", weapon: "sword", sash: 0x8a2a2a, eyeStyle: "angry", mouth: "fang" }],
  温羅: ["hum", { build: "bulky", skin: 0xc85a3a, horns: 2, hornLen: 0.5, hair: "wild", hairColor: 0x2a1a14, weapon: "club", eyeStyle: "angry", mouth: "fang", eyeN: 1, eyeSize: 0.3 }],
  宿儺: ["hum", { build: "bulky", skin: 0xb86a4a, arms: 4, twoFaces: true, hair: "topknot", weapon: "sword", eyeStyle: "angry" }],
  手長: ["hum", { build: "slim", skin: 0x8a9a6a, longArms: true, hair: "wild", eyeStyle: "angry" }],
  足長: ["hum", { build: "slim", skin: 0x9a8a6a, longLegs: true, hair: "wild", eyeStyle: "round" }],
  大百足: ["serpent", { skin: 0x7a2a1a, legs: "centipede", segments: 14, eyeStyle: "angry", eyeColor: 0xffd040, stripe: 0.2 }],
  山男: ["hum", { build: "fat", skin: 0x8a6a4a, hair: "wild", hairColor: 0x3a2a1a, weapon: "club", pelt: 0x5a4a2a, eyeStyle: "angry" }],
  山爺: ["hum", { build: "slim", skin: 0xa8987a, eyeN: 1, eyeSize: 0.32, hair: "wild", hairColor: 0xe8e8e8, weapon: "staff" }],
  鬼熊: ["quad", { skin: 0x3a2a24, ears: "round", horns: "one", size: 1.3, eyeStyle: "angry", mouth: "fang", snout: 0.6 }],
  // 怪
  狐火: ["flame", { skin: 0x6ab8ff, foxFace: true, orbs: 2 }],
  釣瓶火: ["flame", { skin: 0x7ae0c0, eyeStyle: "sleepy", lantern: true }],
  不知火: ["flame", { skin: 0xff5a8a, orbs: 3, eyeStyle: "round" }],
  竜灯: ["serpent", { skin: 0x3ac8e0, horns: true, whiskers: true, mane: 0xf2d15c, segments: 12, eyeStyle: "angry" }],
  天火: ["flame", { skin: 0xff9a2a, eyeStyle: "angry", mouth: "fang", orbs: 1 }],
  叢原火: ["flame", { skin: 0xe04a3a, eyeStyle: "angry", mouth: "open" }],
  古籠火: ["stone", { shape: "lantern", skin: 0x8a8a90, flameColor: 0x6ab8ff, eyeStyle: "sleepy" }],
  青行灯: ["ghost", { skin: 0x6a9aff, headColor: 0xd8e4ff, hair: "long", hairColor: 0x1a2a5a, horns: 1, wisps: 0x6ab8ff }],
  陰摩羅鬼: ["bird", { skin: 0x3a3a4a, crest: 0x6a8a6a, flames: 0x7ae0c0, eyeStyle: "angry" }],
  雷獣: ["quad", { skin: 0x3a5aa8, ears: "fox", tail: "bushy", tails: 1, mane: 0xf2d15c, eyeStyle: "angry", mouth: "fang", flames: 0xffe04a }],
  鵺: ["bird", { skin: 0x8a6a3a, face: "monkey", snakeTail: true, wingColor: 0x5a4a3a, size: 1.1 }],
  管狐: ["quad", { skin: 0xf2e0b8, long: true, shortLegs: true, ears: "fox", tail: "bushy", size: 0.8, snout: 0.7 }],
  白蔵主: ["hum", { build: "slim", skin: 0xf2e6d0, head: "fox", robe: true, cloth: 0x6a5a8a, weapon: "staff", tail: "bushy", tailColor: 0xf2e6d0 }],
  妖狐: ["quad", { skin: 0xf2c46a, ears: "fox", tail: "bushy", tails: 5, snout: 0.7, eyeStyle: "slit" }],
  葛の葉: ["hum", { build: "slim", skin: 0xf4e2d0, robe: true, cloth: 0xf4f4f4, hair: "long", ears: "fox", tail: "bushy", tailColor: 0xf4f0e0, blush: true }],
  // 祟
  土蜘蛛: ["critter", { kind: "spider", skin: 0x4a3a2a, pattern: 0xe0a030 }],
  絡新婦: ["critter", { kind: "spider", skin: 0x2a2a3a, pattern: 0xe05a8a, womanTop: true, cloth: 0xa83a6a }],
  姑獲鳥: ["bird", { skin: 0xe8e0d0, face: "human", hair: "long", wingColor: 0xb8b0a0 }],
  怨霊: ["ghost", { skin: 0x9a8ac0, hair: "long", tri: true, eyeStyle: "angry", wisps: 0x9a7ae0 }],
  生霊: ["ghost", { skin: 0xc0e0ff, hair: "long", eyeStyle: "sleepy", alpha: 0.6 }],
  死霊: ["ghost", { skin: 0x6a6a7a, tri: true, eyeStyle: "glow", mouth: "fang" }],
  骨女: ["critter", { kind: "skeleton", hair: "long", shroud: 0xd48ac0 }],
  餓鬼: ["hum", { build: "fat", skin: 0x8a9a7a, head: "round", headSize: 0.4, eyeStyle: "angry", mouth: "open", sash: 0xc8b8a8 }],
  目目連: ["object", { thing: "shoji" }],
  蛇帯: ["serpent", { skin: 0xc84a8a, stripe: 0.3, segments: 12, eyeStyle: "slit" }],
  縊鬼: ["ghost", { skin: 0x5a6a5a, hair: "wild", eyeStyle: "angry", mouth: "open" }],
  逆柱: ["object", { thing: "pillar", skin: 0x8a6a4a }],
  橋姫: ["hum", { build: "slim", skin: 0xf0e0e0, robe: true, cloth: 0xf4f4f4, hair: "long", hat: "candles", eyeStyle: "angry", mouth: "fang", horns: 2 }],
  清姫: ["serpent", { skin: 0x3a8a5a, womanTop: true, cloth: 0xe05a5a, segments: 10 }],
  七人ミサキ: ["ghost", { skin: 0x5a6a8a, hat: "kasa", hatColor: 0x8a7a5a, eyeStyle: "glow", mouth: "none" }],
  // 雅
  化け猫: ["hum", { build: "slim", skin: 0xf2c46a, head: "round", ears: "cat", tail: "thin", tailN: 2, eyeStyle: "slit", eyeColor: 0xf2d15c, robe: true, cloth: 0xd48ac0, mouth: "fang" }],
  五徳猫: ["quad", { skin: 0x3a3a46, ears: "cat", tails: 2, eyeStyle: "slit", hat: "crown", flames: 0xff7a3d }],
  化け草履: ["object", { thing: "sandal", skin: 0xc8a878 }],
  琴古主: ["object", { thing: "koto", skin: 0x8a5a3a, cloth: 0xd48ac0 }],
  琵琶牧々: ["object", { thing: "biwa", skin: 0xa86a3a, beard: true }],
  三味長老: ["object", { thing: "shamisen", skin: 0x3a2a2a, beard: true }],
  瀬戸大将: ["object", { thing: "pottery", skin: 0xf4f0e6 }],
  鳴釜: ["object", { thing: "kettle", skin: 0x5a5a64 }],
  払子守: ["object", { thing: "whisk" }],
  木魚達磨: ["object", { thing: "mokugyo", skin: 0xc8443a }],
  面霊気: ["object", { thing: "mask", skin: 0xf4f0e6, horns: true }],
  文車妖妃: ["object", { thing: "cartLetters", cloth: 0xd48ac0 }],
  白粉婆: ["hum", { build: "slim", skin: 0xf8f8f8, robe: true, cloth: 0x8a5a8a, hair: "bun", hairColor: 0xd8d8d8, weapon: "brush", blush: true }],
  お歯黒べったり: ["hum", { build: "slim", skin: 0xf8f4ec, robe: true, cloth: 0xc84a6a, hair: "bun", noFace: true, mouth: "none", headTall: 1.1 }],
  高女: ["hum", { build: "tall", skin: 0xf4e2d0, robe: true, cloth: 0x6a3a8a, hair: "long", longNeck: false, headSize: 0.3, eyeStyle: "angry" }],
  二口女: ["hum", { build: "slim", skin: 0xf4e2d0, robe: true, cloth: 0x3a6a8a, hair: "long", twoFaces: true, blush: true }],
  飛頭蛮: ["hum", { build: "slim", skin: 0xe8c8a8, longNeck: true, robe: true, cloth: 0x8a3a3a, hair: "topknot", eyeStyle: "angry" }],
  化け提灯: ["object", { thing: "lantern" }],
  // 剛
  塗仏: ["blob", { skin: 0x2a2a34, eyeStyle: "glow", tall: 1.4, arms: true, mouth: "open" }],
  大入道: ["hum", { build: "fat", skin: 0xe8b890, head: "round", headSize: 0.45, robe: true, cloth: 0x3a3a48, eyeStyle: "angry", size: 1.2 }],
  見上げ入道: ["hum", { build: "tall", skin: 0xd8a880, robe: true, cloth: 0x4a3a2a, headSize: 0.3, eyeN: 1, eyeSize: 0.3, eyeStyle: "angry" }],
  牛打ち坊: ["hum", { build: "fat", skin: 0x6a5a4a, head: "bull", weapon: "mallet", pelt: 0x3a2a24 }],
  石妖: ["stone", { skin: 0x8a8a90, arms: true, feet: true }],
  夜泣き石: ["stone", { skin: 0x7a7a88, tears: true, eyeStyle: "sleepy", mouth: "open" }],
  殺生石: ["stone", { skin: 0x5a4a5a, aura: 0x9a5ae0, eyeStyle: "angry", rope: true }],
  岩魚坊主: ["critter", { kind: "fish", skin: 0x6a7a6a, monkHead: true, spots: 0xf2d15c }],
  大座頭: ["hum", { build: "tall", skin: 0xe8c8a8, robe: true, cloth: 0x5a4a3a, eyeStyle: "sleepy", weapon: "staff", hat: "kasa", hatColor: 0x8a7a5a }],
  山地乳: ["quad", { skin: 0x5a4a5a, ears: "round", wings: 0x4a3a4a, snout: 0.7, eyeStyle: "sleepy" }],
  野槌: ["serpent", { skin: 0x8a7a5a, segments: 6, size: 1.4, eyeStyle: "round", mouth: "open" }],
  蟹坊主: ["critter", { kind: "crab", skin: 0xd9583b, monk: true }],
  栄螺鬼: ["critter", { kind: "shell", skin: 0xc8a878 }],
  鉄鼠: ["quad", { skin: 0x7a7a88, ears: "round", snout: 0.8, tail: "thin", size: 1.1, eyeStyle: "angry", mouth: "fang", hat: "tokin" }],
  大亀: ["critter", { kind: "turtle", skin: 0x8aa06a, shell: 0x5a4a2a, mossTail: true }],
  鎧武者: ["hum", { build: "bulky", skin: 0x2a2a34, torsoColor: 0x8a2a2a, sash: 0xd9b24a, hat: "crown", weapon: "sword", eyeStyle: "glow", mouth: "none" }],
  埴輪武者: ["stone", { shape: "haniwa", skin: 0xc8784a }],
  石塔: ["stone", { shape: "pagoda", skin: 0x9a9aa4 }],
  // 鎮
  獏: ["quad", { skin: 0x3a3a46, belly: 0xf4f4f4, trunk: true, ears: "round", snout: 0, eyeStyle: "sleepy", size: 1.2 }],
  八咫烏: ["bird", { skin: 0x1c1c28, legs: 3, beak: 0x3a3a48, crest: 0xd9b24a, eyeStyle: "angry" }],
  守宮: ["critter", { kind: "lizard", skin: 0x6a8a5a }],
  石敢當: ["stone", { shape: "tablet", skin: 0xa8a8b0, eyeStyle: "angry" }],
  道祖神: ["stone", { shape: "tablet", skin: 0x8a9a8a, eyeStyle: "sleepy", mouth: "smile", arms: true }],
  霊亀: ["critter", { kind: "turtle", skin: 0x6ac8b0, shell: 0x2a6a5a, mossTail: true }],
  白蛇: ["serpent", { skin: 0xf4f4f8, eyeColor: 0xff4a6a, stripe: -0.05 }],
  大鯰: ["critter", { kind: "catfish", skin: 0x4a4a3a }],
  蛟: ["serpent", { skin: 0x3a7ac8, horns: true, whiskers: true, segments: 12 }],
  人魚: ["hum", { build: "slim", skin: 0xf4e2d0, hair: "long", hairColor: 0x3a8ac8, robe: true, cloth: 0x3ac8b0, blush: true, tail: "snake", tailColor: 0x3ac8b0 }],
  共潜き: ["ghost", { skin: 0x3a6a8a, hair: "long", headColor: 0xe8d0c0, hat: "hood", hatColor: 0xf4f4f4 }],
  磯女: ["ghost", { skin: 0x2a4a6a, hair: "long", hairColor: 0x0a1a2a, headColor: 0xe8f0f4, eyeStyle: "angry" }],
  濡れ女: ["serpent", { skin: 0x2a5a4a, womanTop: true, cloth: 0x2a3a5a, segments: 12 }],
  海和尚: ["critter", { kind: "turtle", skin: 0x6a8a7a, shell: 0x3a4a3a, hat: "kasa" }],
  神鹿: ["quad", { skin: 0xc8905a, horns: "antler", ears: "cat", belly: 0xf4ecd8, snout: 0.6, eyeStyle: "round", spots: true }],
  狛狐: ["quad", { skin: 0xf4f0e6, ears: "fox", tail: "bushy", mane: 0xc8443a, snout: 0.7, eyeStyle: "angry" }],
  // 影
  烏天狗: ["hum", { build: "slim", skin: 0x1c1c28, head: "bird", beak: 0x3a3a48, wings: 0x1c1c28, hat: "tokin", robe: false, weapon: "sword", sash: 0xd9b24a, eyeStyle: "angry" }],
  木の葉天狗: ["hum", { build: "child", skin: 0x6a8a4a, head: "bird", wings: 0x5a7a3a, hat: "tokin", weapon: "fan", eyeStyle: "angry" }],
  以津真天: ["bird", { skin: 0x5a2a3a, face: "human", hair: "wild", hairColor: 0x2a0a14, wingColor: 0x3a1a24, legs: 2, size: 1.1 }],
  飛縁魔: ["hum", { build: "slim", skin: 0xf4e2d0, robe: true, cloth: 0xc8303a, hair: "long", blush: true, eyeStyle: "slit", eyeColor: 0xff6a4a, weapon: "fan" }],
  風狸: ["quad", { skin: 0x8a9a8a, ears: "round", tail: "bushy", snout: 0.5, size: 0.9, eyeStyle: "round" }],
  すねこすり: ["quad", { skin: 0xe8d8c0, ears: "floppy", tail: "bushy", size: 0.75, snout: 0.35, eyeStyle: "round" }],
  送り犬: ["quad", { skin: 0x6a6a74, ears: "cat", tail: "bushy", snout: 0.8, eyeStyle: "angry", mouth: "fang" }],
  送り狼: ["quad", { skin: 0x4a4a5a, ears: "fox", tail: "bushy", snout: 0.9, eyeStyle: "angry", mouth: "fang", size: 1.15, mane: 0x6a6a7a }],
  狢: ["quad", { skin: 0x7a6a5a, ears: "round", tail: "bushy", snout: 0.6, belly: 0xc8b8a0, eyeStyle: "sleepy", leaf: true }],
  飯綱: ["quad", { skin: 0xd8c8a8, long: true, shortLegs: true, ears: "round", tail: "thin", size: 0.85, snout: 0.6 }],
  片輪車: ["object", { thing: "wheel", skin: 0x6a4a3a, flames: 0xff7a3d, faceColor: 0xf4e2d0 }],
  朧車: ["object", { thing: "cart", skin: 0x5a4a3a }],
  輪入道: ["object", { thing: "wheel", skin: 0x3a2a24, flames: 0xff4a2a, faceColor: 0xe8b890 }],
  鎌風: ["quad", { skin: 0xa8c0d8, long: true, shortLegs: true, ears: "round", sickles: true, size: 0.9, eyeStyle: "angry" }],
  疾風丸: ["hum", { build: "slim", skin: 0x2a3a4a, headColor: 0xe8c8a8, mask: 0x2a3a4a, weapon: "sword", sash: 0xc8443a, eyeStyle: "angry" }],
  韋駄天狐: ["quad", { skin: 0xe07a2a, ears: "fox", tail: "bushy", long: true, snout: 0.8, eyeStyle: "angry" }],
  野鉄砲: ["quad", { skin: 0x8a7a5a, wings: 0x6a5a4a, ears: "round", snout: 0.5, size: 0.85 }],
  野衾: ["quad", { skin: 0x9a8a6a, wings: 0x7a6a4a, ears: "round", tail: "bushy", size: 0.9, eyeStyle: "round" }],
  隼人: ["hum", { build: "slim", skin: 0x3a2a24, head: "bird", beak: 0xe0a030, wings: 0x6a5a4a, weapon: "spear", sash: 0xd9b24a, eyeStyle: "angry" }],
  夜雀: ["bird", { skin: 0x5a4a3a, size: 0.8, eyeStyle: "angry" }],
  通り悪魔: ["hum", { build: "slim", skin: 0x3a1a3a, horns: 2, hair: "wild", hairColor: 0x1a0a1a, weapon: "sword", eyeStyle: "glow", mouth: "fang", tail: "thin" }],
  隙間風: ["ghost", { skin: 0xc8e8f0, alpha: 0.45, eyeStyle: "sleepy", mouth: "open", wisps: 0xe0f4ff }],
  一本だたら: ["hum", { build: "bulky", skin: 0x7a6a5a, eyeN: 1, eyeSize: 0.34, longLegs: false, hair: "wild", weapon: "mallet", eyeStyle: "angry" }],
  // 和
  福の神: ["hum", { build: "fat", skin: 0xf4d8b8, robe: true, cloth: 0xd9b24a, hat: "eboshi", weapon: "mallet", blush: true, eyeStyle: "sleepy" }],
  竈神: ["hum", { build: "child", skin: 0xe8a86a, robe: true, cloth: 0xc8443a, hair: "wild", hairColor: 0xff7a3d, weapon: "fan" }],
  蔵ぼっこ: ["hum", { build: "child", skin: 0xf4e2d0, robe: true, cloth: 0x6a8a4a, hair: "bob", blush: true, weapon: "bag" }],
  雨降り小僧: ["hum", { build: "child", skin: 0xf4e2d0, robe: true, cloth: 0x3a6ac8, hat: "tofuhat", hatColor: 0x8a6a3a, blush: true }],
  豆腐小僧: ["hum", { build: "child", skin: 0xf4e2d0, robe: true, cloth: 0xd9a0c0, hat: "tofuhat", hatColor: 0x6a5a3a, weapon: "tray", blush: true }],
  狸囃子: ["quad", { skin: 0x8a6a44, belly: 0xe8d2a8, ears: "round", tail: "bushy", drum: true, leaf: true, snout: 0.45, eyeStyle: "round" }],
  豆狸: ["quad", { skin: 0x9a7a54, belly: 0xe8d2a8, ears: "round", tail: "bushy", size: 0.75, leaf: true, snout: 0.45 }],
  小豆洗い: ["hum", { build: "child", skin: 0xe8c8a8, robe: true, cloth: 0x6a5a4a, hair: "wild", hairColor: 0xd8d8d8, weapon: "bowl", eyeStyle: "sleepy" }],
  枕返し: ["hum", { build: "child", skin: 0xf4e2d0, robe: true, cloth: 0x4a4a8a, hat: "tokin", eyeStyle: "sleepy", weapon: "bag" }],
  家鳴り: ["blob", { skin: 0x8a5a3a, size: 0.7, horns: true, arms: true, feet: true, eyeStyle: "angry", mouth: "fang" }],
  天女: ["hum", { build: "slim", skin: 0xf8e8e0, robe: true, cloth: 0xf4c0d8, hair: "bun", hat: "halo", blush: true }],
  羽衣: ["ghost", { skin: 0xf4e0f0, headColor: 0xf8e8e0, hair: "bun", blush: true, eyeStyle: "sleepy", mouth: "smile", alpha: 0.75 }],
  花の精: ["blob", { skin: 0xf29ab8, cap: 0xff7aa8, leaf: true, blush: true, arms: true, size: 0.8 }],
  桃の精: ["blob", { skin: 0xffb0a0, leaf: true, blush: true, arms: true, size: 0.85, tall: 1.05 }],
  吉兆鳥: ["bird", { skin: 0xf2d15c, crest: 0xff7a3d, longBeak: false, wingColor: 0xe0a030, eyeStyle: "round" }],
  霊芝: ["critter", { kind: "mushroom", skin: 0xa8402a }],
  // 禍
  大禍津: ["hum", { build: "bulky", skin: 0x3a0a14, horns: 2, hornLen: 1.1, hornColor: 0x8a1a2a, hair: "wild", hairColor: 0xb0303a, weapon: "sword", eyeStyle: "glow", mouth: "fang", wings: 0x2a0a14 }],
  禍神: ["ghost", { skin: 0x5a1a2a, eyeN: 3, eyeStyle: "angry", eyeColor: 0xff4a4a, mouth: "fang", wisps: 0xb0303a }],
  黄泉醜女: ["hum", { build: "slim", skin: 0x5a6a5a, robe: true, cloth: 0x2a2a34, hair: "wild", hairColor: 0x0a0a14, eyeStyle: "glow", mouth: "fang", longArms: true }],
  常闇: ["ghost", { skin: 0x14101c, eyeStyle: "glow", mouth: "none", wisps: 0x7a3ae0, alpha: 0.9 }],
  大魔縁: ["hum", { build: "bulky", skin: 0x6a2a3a, nose: "long", wings: 0x2a1a24, hat: "tokin", weapon: "fan", eyeStyle: "angry", robe: true, cloth: 0x3a1a2a }],
  天魔: ["hum", { build: "slim", skin: 0x3a2a4a, horns: 2, wings: 0x1a1024, nose: "long", eyeStyle: "glow", weapon: "staff" }],
  夜刀神: ["serpent", { skin: 0x3a3a24, horns: true, hornColor: 0xd9b24a, eyeColor: 0xff6a2a, segments: 13 }],
};

// 最初の 24 体
var HAND_MODEL = {
  oni: ["hum", { build: "bulky", skin: 0xd9483b, horns: 2, hair: "wild", hairColor: 0x1c1820, weapon: "club", pelt: 0xf2d15c, eyeStyle: "angry", mouth: "fang" }],
  karakasa: ["object", { thing: "umbrella", skin: 0x7a5bc4 }],
  yukionna: ["hum", { build: "slim", skin: 0xf4f7ff, robe: true, cloth: 0xe8f4ff, hair: "long", hairColor: 0x20243a, eyeStyle: "sleepy", sash: 0xaac8e8 }],
  nekomata: ["quad", { skin: 0x3a3446, ears: "cat", tails: 2, eyeStyle: "slit", tailColor: 0x3a3446, snout: 0.35 }],
  kappa: ["hum", { build: "child", skin: 0x5aa55a, dish: true, hair: "wild", hairColor: 0x2f5f3a, shell: 0x6b8f3a, head: "bird", beak: 0xf2c14a }],
  ogama: ["critter", { kind: "frog", skin: 0x7a6a3a, size: 1.3 }],
  bakedanuki: ["quad", { skin: 0x8a6a44, belly: 0xe8d2a8, ears: "round", tail: "bushy", leaf: true, snout: 0.45 }],
  rokurokubi: ["hum", { build: "slim", skin: 0xf1d9c4, longNeck: true, robe: true, cloth: 0xc75b8a, hair: "bun", hairColor: 0x20243a, eyeStyle: "sleepy" }],
  zashiki: ["hum", { build: "child", skin: 0xf7e3cc, robe: true, cloth: 0xc8443a, hair: "bob", hairColor: 0x1c1a24, blush: true }],
  kodama: ["blob", { skin: 0xeef2e6, eyeStyle: "glow", mouth: "open", tall: 1.2, arms: true, size: 0.85 }],
  tengu: ["hum", { build: "bulky", skin: 0xc8443a, nose: "long", wings: 0x3f8f5a, hat: "tokin", weapon: "fan", hair: "wild", hairColor: 0xf4f4f4, eyeStyle: "angry" }],
  kamaitachi: ["quad", { skin: 0xc8a06a, long: true, shortLegs: true, ears: "round", sickles: true, eyeStyle: "angry" }],
  shuten: ["hum", { build: "fat", skin: 0xe05a4a, horns: 2, hair: "wild", hairColor: 0xd9483b, robe: true, cloth: 0x3a2a4a, weapon: "bowl", blush: true, eyeStyle: "angry" }],
  ushioni: ["critter", { kind: "spider", skin: 0x3a3a46, bullHead: true, size: 1.2 }],
  otakemaru: ["hum", { build: "bulky", skin: 0x3a4ac8, horns: 2, hornLen: 1.0, hair: "wild", hairColor: 0xf2d15c, weapon: "sword", hat: "crown", eyeStyle: "angry", mouth: "fang" }],
  nurikabe: ["stone", { shape: "wall", skin: 0x9a948a, feet: true, eyeStyle: "sleepy" }],
  ittan: ["object", { thing: "cloth", skin: 0xf4f4f4 }],
  onibi: ["flame", { skin: 0x7a9aff, eyeStyle: "angry" }],
  kasha: ["quad", { skin: 0x3a2a24, ears: "cat", flames: 0xff7a3d, eyeStyle: "slit", mouth: "fang", size: 1.15, tails: 2 }],
  kyokotsu: ["critter", { kind: "skeleton", hair: "wild", hairColor: 0xd8d8d8, bucket: true }],
  waira: ["quad", { skin: 0x7a8a5a, ears: "round", snout: 0.5, size: 1.2, eyeStyle: "angry", mouth: "fang", tail: "thin" }],
  komainu: ["quad", { skin: 0x3fb89a, mane: 0x2f8a74, ears: "round", horns: "one", tail: "bushy", eyeStyle: "angry", mouth: "fang" }],
  yamabiko: ["quad", { skin: 0x8a8a9a, ears: "floppy", snout: 0.4, eyeStyle: "round", tail: "bushy", size: 0.9 }],
  hakutaku: ["quad", { skin: 0xf2efe6, horns: "ox", eyesMany: true, eyeN: 3, snout: 0.6, mane: 0xd9b24a, size: 1.2 }],
};

var TRIBE_TINT = { takeru: 0xd9644a, ayashi: 0x8a6ee0, tsuwamono: 0x8f8a74, kage: 0x4f9fb8, nagomi: 0x6fbf73, miyabi: 0xd48ac0, tatari: 0x7d5a9e, shizume: 0x5f88c9, maga: 0xb0303a };

function modelSpec(def) {
  if (HAND_MODEL[def.id]) return HAND_MODEL[def.id];
  const z = zi[def.id];
  return FAMILY_MODEL[z?.family] ?? ["blob", { skin: TRIBE_TINT[def.tribe] }];
}

// 段階（小・並・大）と 1 体ごとの色ずれ
function unitVariant(def) {
  const z = zi[def.id];
  const form = z ? z.form : def.rank === "S" || def.rank === "A" ? 2 : 1;
  const seed = z?.seed ?? hash32(def.id);
  return { form, seed };
}

function buildYokaiModel(def) {
  const [plan, base] = modelSpec(def);
  const { form, seed } = unitVariant(def);
  const k = new ModelKit(seed);
  const o = { ...base };
  // 段階ごとに色を少し変える（小は明るく、大は深く）＋ 1 体ごとの揺らぎ
  const tweak = [0.18, 0, -0.12][form] + (k.rnd() - 0.5) * 0.12;
  for (const key of ["skin", "cloth", "torsoColor", "headColor", "hairColor", "wingColor"]) if (o[key] !== undefined) o[key] = shade(o[key], tweak);
  const res = PLANS[plan](k, o);
  // 大きさ：形の高さをそろえてから段階で変える
  const root = k.root;
  root.updateMatrixWorld(true);
  let minY = Infinity, maxY = -Infinity;
  root.traverse(obj => {
    if (!obj.isMesh || obj.material.side === Lt) return;
    obj.geometry.boundingBox || obj.geometry.computeBoundingBox();
    const bb = obj.geometry.boundingBox.clone().applyMatrix4(obj.matrixWorld);
    minY = Math.min(minY, bb.min.y), maxY = Math.max(maxY, bb.max.y);
  });
  const h = Math.max(0.3, maxY - Math.min(0, minY));
  const target = [1.35, 1.65, 1.95][form] * (base.size && plan !== "quad" ? Math.min(1.25, base.size) : 1) * (def.group ? 1.2 : 1);
  const scale = target / h;
  const outer = new qr();
  const inner = new qr();
  inner.add(root);
  inner.scale.setScalar(scale);
  inner.position.y = -Math.min(0, minY) * scale;
  outer.add(inner);
  // 大（段階 3）は足もとに光の輪
  if (form === 2) {
    const aura = new pt(geo().ring, k.mat(def.rank === "S" ? 0xf2d15c : 0x9ad0ff, { basic: true, alpha: 0.5 }));
    aura.material.side = 2;
    aura.rotation.x = -Math.PI / 2;
    aura.position.y = 0.04;
    aura.scale.set(0.75, 0.75, 1);
    outer.add(aura);
    k.anim.push({ obj: aura, spin: true, speed: 0.8 });
  }
  outer.userData = { anim: k.anim, mats: [...k.mats.values()], height: target, headObj: res.head };
  return outer;
}

// 毎フレームの小さな動き（しっぽ・翼・炎）
function animateModel(model, t) {
  for (const a of model.userData.anim) {
    if (a.flicker) { const s = 1 + Math.sin(t * a.speed + a.phase) * 0.12; a.obj.scale.set(1 / s, s, 1 / s); continue; }
    if (a.spin) { a.obj.rotation.z = t * a.speed; continue; }
    const v = Math.sin(t * a.speed + a.phase) * a.amp;
    if (a.pos) a.obj.position.y = a.base + v; else a.obj.rotation[a.axis] = a.base + v;
  }
}

// ひかる（被弾）・うすくなる（気絶）
function setModelLook(model, flash, opacity) {
  for (const m of model.userData.mats) {
    if (m.emissive) {
      const base = m.userData.baseEmissive;
      if (flash > 0.01) m.emissive.setRGB(Math.min(1, ((base >> 16 & 255) / 255) + flash * 0.9), Math.min(1, ((base >> 8 & 255) / 255) + flash * 0.9), Math.min(1, ((base & 255) / 255) + flash * 0.9));
      else m.emissive.setHex(base);
    }
    const op = m.userData.baseOpacity * opacity;
    const tr = op < 0.999 || m.userData.baseOpacity < 1;
    if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
    m.opacity = op;
  }
}

// 編成画面の回転プレビュー（1 つの WebGL を使い回す）
var PREVIEW = null;
function previewRenderer() {
  if (PREVIEW) return PREVIEW;
  const canvas = document.createElement("canvas");
  canvas.className = "b-3d";
  const renderer = new v1({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new E1();
  scene.add(new V1(0xb8b0d8, 1.9));
  const sun = new z1(0xfff0d0, 1.6);
  sun.position.set(2, 4, 5);
  scene.add(sun);
  const rim = new z1(0x9ad0ff, 0.9);
  rim.position.set(-3, 2, -3);
  scene.add(rim);
  const floor = new pt(new b1(1.1, 40), new Aa({ color: 0x000000, transparent: true, opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const camera = new qt(32, 1, 0.1, 50);
  PREVIEW = { canvas, renderer, scene, camera, model: null, id: null, raf: 0, t0: performance.now(), drag: null, yaw: 0.5 };
  canvas.addEventListener("pointerdown", e => { PREVIEW.drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", e => { if (PREVIEW.drag !== null) { PREVIEW.yaw += (e.clientX - PREVIEW.drag) * 0.012; PREVIEW.drag = e.clientX; } });
  canvas.addEventListener("pointerup", () => { PREVIEW.drag = null; });
  return PREVIEW;
}

function showPreview(host, def) {
  const P = previewRenderer();
  if (P.canvas.parentElement !== host) host.replaceChildren(P.canvas);
  if (P.id !== def.id) {
    if (P.model) P.scene.remove(P.model);
    P.model = buildYokaiModel(def);
    P.scene.add(P.model);
    P.id = def.id;
    const h = P.model.userData.height;
    P.camera.position.set(0, h * 0.62, h * 2.35 + 1.2);
    P.camera.lookAt(0, h * 0.48, 0);
  }
  const size = () => {
    const w = host.clientWidth || 200, hh = host.clientHeight || 200;
    P.renderer.setSize(w, hh, false);
    P.camera.aspect = w / hh;
    P.camera.updateProjectionMatrix();
  };
  size();
  if (!P.raf) {
    const loop = () => {
      if (!P.canvas.isConnected) { P.raf = 0; return; }
      const t = (performance.now() - P.t0) / 1000;
      if (P.drag === null) P.yaw += 0.008;
      if (P.model) { P.model.rotation.y = P.yaw; animateModel(P.model, t); }
      if (P.canvas.clientWidth && P.canvas.width !== Math.round(P.canvas.clientWidth * P.renderer.getPixelRatio())) size();
      P.renderer.render(P.scene, P.camera);
      P.raf = requestAnimationFrame(loop);
    };
    P.raf = requestAnimationFrame(loop);
  }
}
