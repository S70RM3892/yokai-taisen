// ============================================================================
// 流行りの型（本家の通信対戦で流行った編成・docs/PRESETS.md）に出てくる妖怪の超高精細 3D モデル。
// 黒鬼・赤鬼は model_oni.js。道具は hires_kit.js。
// 見た目の出典：Yo-kai Watch Wiki（yokaiwatch.fandom.com）の各妖怪の Biology の説明（2026-09 に確認。
// ページの日本語名で本家の妖怪と同じことを確かめた）。説明にない細かいところ（服のしわ・飾りの数など）はこちらで足した。
// どれも HONKE_NAME_MODEL に ["hi", { hi: "名前" }] で登録し、PLANS.hi が名前ごとの作り方を呼ぶ。
// ============================================================================

var HI_MODELS = {};
PLANS.hi = (k, o) => HI_MODELS[o.hi](k, o, hiKit(k));
// 最後に（ファイルの終わりで）HONKE_NAME_MODEL の登録を上書きする。武器を持つかどうか（行動のモーション）は前の登録から引きつぐ
function hiRegister() {
  for (const n of Object.keys(HI_MODELS)) HONKE_NAME_MODEL[n] = ["hi", { hi: n, weapon: HONKE_NAME_MODEL[n]?.[1]?.weapon }];
}

// ---- 共通の部品 ----

// 人の頭：頭・あご・鼻・耳・目・眉・口。o = { r, skin, jaw, nose, ear（"pointed" / "round" / "big"）, eyes（hiEyes の設定）, brow（色）, browTilt, mouth（"line" / "smile" / "open" / "fang"）, lips }
function hiHead(H, par, p, o) {
  const k = H.k, r = o.r, skin = o.skin;
  const head = k.group(par, p);
  H.O(head, H.ball, skin, [0, 0, 0], [r, r * (o.tall ?? 1.08), r * 0.98]);
  if (o.jaw !== false) H.P(head, H.ball, skin, [0, -r * 0.45, r * 0.15], [r * (o.jawW ?? 0.78), r * 0.5, r * 0.78]);
  if (o.nose !== false) H.P(head, H.ball, o.noseColor ?? shade(skin, -0.05), [0, -r * 0.08, r * 0.98], [r * (o.noseW ?? 0.14), r * (o.noseH ?? 0.18), r * (o.noseL ?? 0.14)]);
  const ear = o.ear ?? "round";
  for (const s of [-1, 1]) {
    if (ear === "pointed") H.O(head, H.tube("earP", t => [t * 0.8, t * 0.35, -t * 0.2], t => 0.3 * Math.pow(1 - t, 0.7) + 0.02, 14, 10), skin, [s * r * 0.92, 0, -r * 0.05], [s * r, r, r]);
    else if (ear === "big") H.O(head, H.ball, skin, [s * r * 1.0, -r * 0.2, -r * 0.05], [r * 0.2, r * 0.42, r * 0.28]);
    else if (ear !== "none") H.P(head, H.ball, skin, [s * r * 0.97, -r * 0.05, 0], [r * 0.13, r * 0.24, r * 0.16]);
  }
  if (o.eyes) hiEyes(H, head, { x: r * 0.36, y: r * 0.12, z: r * 0.84, r: r * 0.2, ...o.eyes });
  if (o.brow !== void 0) for (const s of [-1, 1]) H.P(head, H.tube("brow", t => [t * 0.9, t * 0.12, -t * t * 0.25], t => 0.14 * (1 - t * 0.4), 14, 8), o.brow, [s * r * 0.16, r * (o.browY ?? 0.42), r * 0.9], [s * r * 0.5, r * 0.5, r * 0.5], [0, 0, s * -(o.browTilt ?? 0)]);
  const m = o.mouth ?? "line", my = -r * (o.mouthY ?? 0.5), mz = r * 0.9;
  if (m === "open" || m === "fang") {
    H.P(head, H.ball, 0x5a1020, [0, my, mz - r * 0.05], [r * 0.3, r * 0.16, r * 0.14]);
    if (m === "fang") for (const s of [-1, 1]) H.P(head, H.tube("fangS", t => [0, -t, 0], t => 0.5 * (1 - t) + 0.02, 8, 8), 0xffffff, [s * r * 0.14, my + r * 0.12, mz + r * 0.02], r * 0.12);
  } else if (m === "smile") H.P(head, H.tube("smile", t => [(t - 0.5) * 1.0, -Math.sin(t * Math.PI) * 0.18, 0], 0.05, 16, 6), 0x3a1018, [0, my + r * 0.05, mz], r * 0.5);
  else if (m === "line") H.P(head, H.tube("mline", t => [(t - 0.5), -Math.sin(t * Math.PI) * 0.06, 0], 0.045, 12, 6), 0x3a1018, [0, my, mz], r * 0.45);
  if (o.lips) for (const [y, sy] of [[0.06, 0.07], [-0.08, 0.09]]) H.P(head, H.ball, o.lips, [0, my + r * y, mz - r * 0.02], [r * 0.32, r * sy, r * 0.12]);
  return head;
}

// 猫の頭（ジバニャンの仲間）：大きな丸い頭・大きな黒目・小さな鼻・口・耳
function hiCatHead(H, par, p, o) {
  const k = H.k, r = o.r;
  const head = k.group(par, p);
  H.O(head, H.ball, o.fur, [0, 0, 0], [r * 1.12, r * 0.95, r]);
  if (o.face) { // 白い顔（口のまわり）
    H.P(head, H.ball, o.face, [0, -r * 0.28, r * 0.42], [r * 0.78, r * 0.55, r * 0.62]);
  }
  for (const s of [-1, 1]) {
    const e = k.group(head, [s * r * 0.62, r * 0.62, -r * 0.05], [0, 0, -s * 0.28]);
    H.O(e, H.lathe("catEar", [[0, 0], [0.34, 0.02], [0.28, 0.3], [0.14, 0.62], [0, 0.78]], 20, 1, 0.55), o.fur, [0, 0, 0], r);
    H.P(e, H.lathe("catEarIn", [[0, 0], [0.22, 0.02], [0.17, 0.3], [0.08, 0.55], [0, 0.66]], 16, 1, 0.3), o.inner, [0, r * 0.03, r * 0.1], r);
  }
  if (o.eyes !== false) hiEyes(H, head, { x: r * 0.38, y: r * 0.06, z: r * 0.82, r: r * 0.26, sy: 1.3, ry: 0.35, white: 0x14101c, iris: 0x14101c, irisR: 0.5, pupilKind: "none", ...o.eyes });
  H.P(head, H.ballS, o.nose ?? 0xe88a9a, [0, -r * 0.18, r * 0.98], [r * 0.08, r * 0.06, r * 0.05]);
  // ω の口
  for (const s of [-1, 1]) H.P(head, H.tube("catMouth", t => [t * 0.5, -Math.sin(t * Math.PI) * 0.22, 0], 0.05, 12, 6), 0x3a1a20, [0, -r * 0.3, r * 0.96], [s * r * 0.26, r * 0.26, r * 0.26]);
  return head;
}

// 2 本のしっぽ（先に炎）
function hiCatTails(H, par, p, fur, flame, n = 2, len = 0.55) {
  const k = H.k;
  for (let i = 0; i < n; i++) {
    const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * 1.1;
    const g = k.group(par, p, [0, spread, 0]);
    const tl = H.tube("catTail" + len, t => [Math.sin(t * 2.5) * 0.06, Math.sin(t * 1.4) * len * 0.8, -t * len * 0.7], t => 0.05 * (1 - t * 0.4), 24, 10);
    H.O(g, tl, fur);
    const tip = [Math.sin(2.5) * 0.06, Math.sin(1.4) * len * 0.8, -len * 0.7];
    hiFlame(H, g, [tip[0], tip[1] + 0.06, tip[2]], 0.07, flame);
    k.swing(g, "y", 0.25, 2.2, i);
  }
}

// 刀（反りのある刃・つば・巻いた柄）。手のグループに置き、+y へのびる
function hiKatana(H, par, len = 0.9, o = {}) {
  const k = H.k, g = k.group(par, [0, 0, 0.02], o.rot ?? [Math.PI / 2 - 0.2, 0, 0]);
  const blade = H.tube("blade" + len, t => [0, 0.18 + t * len, -Math.sin(t * Math.PI * 0.5) * len * 0.06], t => 0.018 * (1 - Math.pow(t, 6)) + 0.002, 30, 4, 0.18);
  H.P(g, blade, 0xe8eef6, 0, 1, 0, { glow: 0x202830 });
  H.P(g, H.ring, o.tsuba ?? 0xc8a040, [0, 0.17, 0], [0.06, 0.2, 0.05]);
  H.P(g, H.lathe("tsuka", [[0, -0.1], [0.022, -0.1], [0.024, 0.16], [0, 0.16]], 12), o.grip ?? 0x2a2230);
  for (let i = 0; i < 6; i++) H.P(g, H.ballS, o.wrap ?? 0xe8e0d0, [0, -0.08 + i * 0.043, 0], [0.026, 0.012, 0.026], [0, i % 2 ? 0.8 : -0.8, 0]);
  return g;
}

// 着物のすそ（腰から下の筒）。y は腰の高さ、len の長さ
function hiRobeSkirt(H, par, key, y, top, bottom, len, color, o = {}) {
  const prof = [[bottom, -len], [bottom * 0.98, -len * 0.7], [(top + bottom) / 2, -len * 0.35], [top, 0]];
  const m = H.two(par, H.sleeve("robe:" + key, prof, 40), color, [0, y, 0], [1, 1, o.sz ?? 0.85]);
  if (o.hem) H.P(par, H.ring, o.hem, [0, y - len, 0], [bottom, 0.25, bottom * (o.sz ?? 0.85)]);
  return m;
}

// ---- ブシニャン：くすんだ青の猫・白い顔・大きな黒目・金の耳の内側・先の白い手足・青緑のかぶと（金の大きな三日月）と
//      そろいのよろい・首輪にオレンジの玉・刀を下げるオレンジのひも・金のしっぽの炎 ----
HI_MODELS.ブシニャン = (k, o, H) => {
  const fur = o.skin ?? 0x5a78b0, white = 0xf6f4ee, armor = 0x2aa89c, gold = 0xd9b24a, orange = 0xf0892a;
  const body = k.group(null);
  // 脚：短く太い。先は白
  for (const s of [-1, 1]) {
    const l = hiLeg(H, body, s, { x: 0.13, y: 0.34, len: 0.34, r: 0.1, skin: fur, foot: "shoe", footColor: white });
    H.P(l.knee, H.ring, gold, [0, -0.09, 0], [0.1, 0.2, 0.1]); // すね当てのふち
    H.O(l.knee, H.lathe("suneate", [[0.105, 0], [0.11, -0.06], [0.1, -0.12]], 24), armor, [0, -0.02, 0]);
  }
  // 胴：丸い体によろいの胴・草ずり（6 枚）・金の縁
  const torso = k.group(body, [0, 0.36, 0]);
  H.O(torso, H.lathe("bushiBody", [[0, 0], [0.18, 0.02], [0.23, 0.12], [0.22, 0.26], [0.17, 0.36], [0, 0.4]], 32), fur);
  H.O(torso, H.lathe("bushiDou", [[0.235, 0.08], [0.245, 0.16], [0.235, 0.26], [0.2, 0.33]], 32, 1, 0.92), armor, 0, 1, 0, void 0, 0.01);
  for (const y of [0.1, 0.2]) H.P(torso, H.ring, gold, [0, y, 0], [0.245, 0.12, 0.225]);
  for (let i = 0; i < 6; i++) {
    const a = (i - 2.5) * 0.52 + Math.PI / 2, g = k.group(torso, [Math.cos(a) * 0.22, 0.04, Math.sin(a) * 0.2], [0, -a + Math.PI / 2, 0]);
    H.O(g, H.lathe("kusazuri", [[0.001, -0.14], [0.07, -0.14], [0.065, 0], [0.001, 0]], 4, 1, 0.12), armor, [0, 0, 0.01], 1, [0.2, Math.PI / 4, 0], void 0, 0.02);
    H.P(g, H.ballS, gold, [0, -0.13, 0.03], [0.05, 0.008, 0.01]);
  }
  // 刀を下げるオレンジのひもと、左の腰のさや
  H.P(torso, H.ring, orange, [0, 0.05, 0], [0.235, 0.18, 0.215]);
  const saya = k.group(torso, [-0.22, 0.04, 0.05], [0.3, 0, -1.2]);
  H.O(saya, H.lathe("saya", [[0, -0.02], [0.028, -0.02], [0.03, 0.5], [0, 0.52]], 12, 1, 0.6), 0x1c1a24);
  // 首輪とオレンジの玉
  H.P(torso, H.ring, 0xc8443a, [0, 0.36, 0.01], [0.15, 0.2, 0.14]);
  H.O(torso, H.ball, orange, [0, 0.32, 0.15], 0.05);
  // 腕：肩によろいの袖（大袖）
  for (const s of [-1, 1]) {
    const a = hiArm(H, body, s, { x: 0.22, y: 0.66, len: 0.3, r: 0.07, skin: fur, hand: "mitt", handColor: white, tilt: 0.45 });
    H.O(a.sh, H.lathe("osode", [[0.001, -0.16], [0.11, -0.16], [0.1, 0], [0.001, 0.02]], 4, 1, 0.3), armor, [s * 0.05, -0.02, 0], 1, [0, Math.PI / 4, s * 0.25], void 0, 0.02);
    H.P(a.sh, H.ballS, gold, [s * 0.09, -0.17, 0], [0.012, 0.012, 0.1]);
    if (s > 0) hiKatana(H, a.hand, 0.62);
  }
  // 頭とかぶと
  const head = hiCatHead(H, body, [0, 1.02, 0.02], { r: 0.4, fur, face: white, inner: gold });
  // かぶと：目の上から頭をおおう半球・前のひさし・金のふち
  const kabuto = k.group(head, [0, 0.2, -0.02]);
  H.O(kabuto, H.dome, armor, [0, 0, 0], [0.47, 0.3, 0.44], 0, void 0, 0.03);
  H.P(kabuto, H.ball, shade(armor, -0.2), [0, 0.02, 0], [0.45, 0.02, 0.42]);
  H.two(kabuto, hiGeo("L:mabisashi", m => m.latheArc([[0.44, 0.0], [0.5, -0.03], [0.55, -0.07]], Math.PI * 0.2, Math.PI * 0.8, 20)), armor, [0, 0, 0.0]);
  H.P(kabuto, H.ring, gold, [0, 0.01, 0], [0.47, 0.22, 0.44]);
  for (let i = 0; i < 7; i++) { const a = Math.PI * (0.15 + i * 0.7 / 6); H.P(kabuto, H.ballS, gold, [Math.cos(a) * 0.42, 0.16, Math.sin(a) * 0.39], 0.018); } // 星（びょう）
  // しころ（横からうしろの垂れ）と、ふきかえし（前のはしの返し）
  H.two(kabuto, hiGeo("L:shikoro", m => m.latheArc([[0.47, 0.0], [0.53, -0.12], [0.6, -0.24]], Math.PI * 0.5 + 0.75, Math.PI * 2.5 - 0.75, 30, null, 1, 0.94)), armor);
  for (const r of [-0.1, -0.2]) H.two(kabuto, hiGeo("L:shikoroLine" + r, m => m.latheArc([[0.5 + (-r) * 0.45, r - 0.004], [0.5 + (-r) * 0.45 + 0.004, r + 0.004]], Math.PI * 0.5 + 0.75, Math.PI * 2.5 - 0.75, 30, null, 1, 0.94)), gold);
  for (const s of [-1, 1]) H.O(kabuto, H.ball, armor, [s * 0.47, -0.08, 0.22], [0.04, 0.12, 0.11], [0, s * 0.6, 0], void 0, 0.05);
  // 前立て：金の大きな三日月
  H.O(kabuto, H.tube("mikazuki", t => { const a = Math.PI * (0.12 + t * 0.76); return [Math.cos(a) * 0.46, Math.sin(a) * 0.46 - 0.1, 0]; }, t => 0.045 * Math.sin(Math.PI * t) + 0.004, 40, 10, 0.4), gold, [0, 0.2, 0.36], 1, [-0.2, 0, 0], { glow: 0x2a1c00 }, 0.01);
  H.P(kabuto, H.ball, gold, [0, 0.1, 0.42], [0.06, 0.06, 0.03], 0, { glow: 0x2a1c00 });
  // しっぽ 2 本、先は金の炎
  hiCatTails(H, body, [0, 0.42, -0.2], fur, 0xf2c34a, 2);
  k.bob(head, 0.012, 2.4);
  return { body, head, top: 1.6 };
};

// ---- マスクドニャーン：オレンジの猫・くすんだピンクの鼻・くすんだ青の耳の内側・黒目・白い口もと／胸／手足の先・
//      宝石のついた くすんだ金の虎のマスク（顔の上半分）・金の首輪に青緑の玉・くすんだ青のしっぽの炎・黒と灰のズボンとブーツ ----
HI_MODELS.マスクドニャーン = (k, o, H) => {
  const fur = o.skin ?? 0xe8842a, white = 0xf6f2ea, gold = 0xc8a44a, blue = 0x6a8ac8;
  const body = k.group(null);
  for (const s of [-1, 1]) {
    const l = hiLeg(H, body, s, { x: 0.15, y: 0.62, len: 0.6, r: 0.11, skin: fur, pants: 0x24222a, baggy: 1.05, foot: "boot", footColor: 0x6a6a74 });
    H.P(l.leg, H.tube("pantsLine", t => [0, -t * 0.3, 0], 0.012, 8, 6), 0x9a9aa4, [s * 0.14, 0, 0], 1); // ズボンの灰の線
  }
  // 胴：たくましい上半身。白い胸
  const torso = k.group(body, [0, 0.6, 0]);
  H.O(torso, H.lathe("mnyTorso", [[0, 0], [0.19, 0.01], [0.21, 0.08], [0.2, 0.2], [0.24, 0.34], [0.27, 0.44], [0.24, 0.52], [0.12, 0.58], [0, 0.6]], 36, 1.15, 0.85), fur);
  H.P(torso, H.ball, white, [0, 0.36, 0.12], [0.2, 0.18, 0.12]);
  for (const s of [-1, 1]) H.P(torso, H.ball, shade(fur, 0.08), [s * 0.12, 0.2, 0.15], [0.08, 0.07, 0.06]); // 腹筋のもり上がり
  H.P(torso, H.ring, 0x24222a, [0, 0.02, 0], [0.22, 0.4, 0.19]); // ズボンのベルト
  // 金の首輪と青緑の玉
  H.P(torso, H.ring, gold, [0, 0.55, 0.01], [0.14, 0.3, 0.12], 0, { glow: 0x201600 });
  H.O(torso, H.ball, 0x2ab0a8, [0, 0.5, 0.13], 0.045, 0, { glow: 0x04201e });
  for (const s of [-1, 1]) hiArm(H, body, s, { x: 0.29, y: 1.08, len: 0.5, r: 0.085, skin: fur, hand: "mitt", handColor: white, tilt: 0.3 });
  // 頭：白い口もと、上半分は虎のマスク
  const head = hiCatHead(H, body, [0, 1.42, 0.03], { r: 0.3, fur, face: white, inner: blue, nose: 0xc87a88, eyes: false });
  // 虎のマスク：頭の上半分をおおう。目の穴から黒目がのぞき、額に宝石、横に虎の縞
  const MP = [[0.3, -0.02], [0.315, 0.06], [0.3, 0.16], [0.24, 0.24], [0.13, 0.29], [0.001, 0.31]], MX = 1.16, MZ = 1.1;
  const onMask = (a, y, lift = 0.004) => { const r = kRadAt(MP, y) + lift; return [Math.cos(a) * r * MX, y, Math.sin(a) * r * MZ]; };
  H.O(head, H.lathe("tigerMask", MP, 40, MX, MZ), gold, [0, 0.02, 0], 1, 0, void 0, 0.008);
  // 鼻すじへ下がるところ
  H.O(head, H.ball, gold, [0, -0.03, 0.3], [0.07, 0.1, 0.05], 0, void 0, 0.03);
  const mask = k.group(head, [0, 0.02, 0]);
  for (const s of [-1, 1]) {
    // 目の穴（黒いふち）と中の黒目
    const eg = k.group(mask, onMask(Math.PI / 2 - s * 0.42, 0.06, 0.002), [0, s * 0.42, 0]);
    H.P(eg, H.ball, 0x14101c, [0, 0, 0], [0.085, 0.075, 0.02]);
    H.P(eg, H.ball, 0x08060c, [0, -0.005, 0.012], [0.06, 0.07, 0.02]);
    H.P(eg, H.ballS, 0xffffff, [-0.015, 0.02, 0.028], [0.014, 0.014, 0.006], 0, { glow: 0x606060 });
    for (let i = 0; i < 3; i++) H.P(mask, hiGeo("T:mstripe" + i, m => m.tube(t => onMask(Math.PI / 2 - (0.95 + t * 0.55), 0.2 - i * 0.07 - Math.sin(t * Math.PI) * 0.03), t => 0.016 * Math.sin(Math.PI * t) + 0.003, 16, 6)), 0x2a2018, 0, [s, 1, 1]);
  }
  for (let i = 0; i < 3; i++) H.P(mask, hiGeo("T:mstripeTop" + i, m => m.tube(t => onMask(Math.PI / 2 + (i - 1) * 0.35, 0.3 - t * 0.12), t => 0.014 * Math.sin(Math.PI * t) + 0.003, 12, 6)), 0x2a2018);
  // 額の宝石と金の台
  const gem = k.group(mask, onMask(Math.PI / 2, 0.19, 0.01), [-0.6, 0, 0]);
  H.P(gem, H.ring, gold, [0, 0, 0], [0.055, 0.2, 0.05], [Math.PI / 2, 0, 0]);
  H.P(gem, H.ball, 0xd8203a, [0, 0, 0.01], [0.045, 0.05, 0.03], 0, { glow: 0x400008 });
  hiCatTails(H, body, [0, 0.66, -0.2], fur, blue, 2, 0.6);
  k.bob(head, 0.01, 2.2);
  return { body, head, top: 1.8 };
};

// ---- オオクワノ神：大きなクワガタの武将。赤みの強い体・太く大きなあご・黄色い顔の模様・黄色い着物（右半分をはだけて
//      よろいの胸と腕が出る）・黒の縁どりと雲のような黒い襟巻き・青い飾りのついた赤い帯・縄 ----
HI_MODELS.オオクワノ神 = (k, o, H) => {
  const shell = o.skin ?? 0x8a3524, dark = shade(shell, -0.35), robe = 0xe8c042, black = 0x1c1a20, red = 0xc8342a;
  const body = k.group(null);
  for (const s of [-1, 1]) {
    const l = hiLeg(H, body, s, { x: 0.24, y: 1.02, len: 1.0, r: 0.14, skin: shell, foot: "claw", claw: dark });
    for (const y of [-0.15, -0.3]) H.P(l.knee, H.ring, dark, [0, y, 0], [0.13, 0.15, 0.13]); // 殻の節
  }
  // 着物のすそ（はかまのように広がる）
  hiRobeSkirt(H, body, "okuwa", 1.12, 0.36, 0.5, 0.62, robe, { hem: black });
  // 胴：よろいの胸（殻の節）
  const torso = k.group(body, [0, 1.08, 0]);
  const tprof = [[0, 0], [0.34, 0.02], [0.36, 0.2], [0.42, 0.45], [0.46, 0.62], [0.36, 0.74], [0.14, 0.8], [0, 0.82]];
  H.O(torso, H.lathe("okuwaTorso", tprof, 40, 1.15, 0.8), shell);
  // 殻の節（はだけた右半分だけ）
  H.P(torso, hiGeo("T:okuwaRidges", m => { for (let i = 0; i < 4; i++) { const y = 0.24 + i * 0.12, r = kRadAt(tprof, y) + 0.01; m.tube(t => { const a = -Math.PI * 0.62 + t * Math.PI * 1.1; return [Math.cos(a) * r * 1.15, y - Math.cos(a) * 0.02, Math.sin(a) * r * 0.8]; }, 0.018, 30, 6); } }), dark);
  // 着物の上半分：左の肩から胸をおおう（右ははだける）
  H.two(torso, hiGeo("L:okuwaRobeTop", m => m.latheArc(tprof.slice(1, 6).map(([r, y]) => [r + 0.025, y]), Math.PI * 0.45, Math.PI * 1.25, 28, null, 1.15, 0.8)), robe);
  H.P(torso, H.tube("okuwaLapel", t => [-0.05 - t * 0.3, 0.74 - t * 0.55, 0.3 - t * 0.02], 0.03, 16, 8), black);
  // 赤い帯・青い飾り・縄
  H.O(torso, H.lathe("okuwaObi", [[0.39, 0], [0.4, 0.08], [0.39, 0.16]], 40, 1.15, 0.8), red, [0, 0.02, 0], 1, 0, void 0, 0.008);
  for (let i = 0; i < 3; i++) H.P(torso, H.ball, 0x2a5ad0, [(i - 1) * 0.14, 0.1, 0.33], [0.035, 0.035, 0.02], 0, { glow: 0x040c28 });
  H.P(torso, H.ring, 0xe8dcc0, [0, 0.19, 0], [0.47, 0.18, 0.33]);
  // 雲のような黒い襟巻き
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; H.O(torso, H.ball, black, [Math.cos(a) * 0.26, 0.8 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.2], 0.1 + (i % 3) * 0.02); }
  for (let i = 0; i < 4; i++) H.O(torso, H.ball, black, [0.32 + i * 0.05, 0.78 - i * 0.1, -0.2 - i * 0.08], 0.09 - i * 0.012); // うしろへなびく端
  // 腕：左は袖（着物）、右はよろいの腕
  hiArm(H, body, -1, { x: 0.52, y: 1.76, len: 0.9, r: 0.12, skin: shell, sleeve: robe, cuff: "bell", hand: "fist", claw: dark });
  const ra = hiArm(H, body, 1, { x: 0.52, y: 1.76, len: 0.9, r: 0.13, skin: shell, hand: "fist", claw: dark, band: dark });
  for (const y of [-0.12, -0.28, -0.42]) H.P(ra.sh, H.ring, dark, [0, y, 0], [0.155, 0.16, 0.155]);
  H.O(ra.sh, H.ball, dark, [0.04, 0.02, 0], [0.2, 0.17, 0.19]); // 肩当て
  // 頭：平たい殻の頭・大きなあご（内側にぎざぎざの歯）・黄色い模様・光る目
  const head = k.group(body, [0, 2.06, 0.04]);
  H.O(head, H.ball, shell, [0, 0, 0], [0.3, 0.22, 0.28]);
  H.P(head, H.ball, dark, [0, 0.1, -0.02], [0.28, 0.12, 0.25]);
  hiEyes(H, head, { x: 0.15, y: 0.03, z: 0.22, r: 0.065, white: 0xffe060, glow: 0x806000, iris: 0x201008, irisR: 0.45, lid: shell, lidTilt: 0.35 });
  for (const s of [-1, 1]) {
    H.P(head, H.tube("okuwaMark", t => [t * 0.14, -t * 0.12 + Math.sin(t * 3) * 0.02, 0], t => 0.016 * Math.sin(Math.PI * t) + 0.004, 16, 6), 0xf2d040, [s * 0.1, -0.03, 0.265], [s, 1, 1], 0, { glow: 0x302400 });
  }
  // 大あご：頭の前から大きく上へ張り出し、先は内側へ曲がる（クワガタ）。内側に歯のでっぱり
  const jc = t => [0.06 + Math.sin(t * 2.4) * 0.26 - t * t * 0.18, 0.02 + t * 0.62 - t * t * 0.1, 0.2 + Math.sin(t * 2) * 0.16 - t * t * 0.1];
  const jaw = H.tube("okuwaJaw2", jc, t => 0.095 * Math.pow(1 - t, 0.6) + 0.012, 48, 14);
  const teeth = hiGeo("B:okuwaTeeth", m => { for (let i = 0; i < 4; i++) { const p = jc(0.3 + i * 0.15); m.lathe([[0, 0], [0.03, 0], [0, 0.08]], 8, kXf([p[0] - 0.05, p[1], p[2]], [0, 0, Math.PI / 2 + 0.3])); } });
  for (const s of [-1, 1]) {
    const g = k.group(head, [s * 0.1, 0.08, 0.1]);
    g.scale.set(s, 1, 1);
    H.O(g, jaw, shell, 0, 1, 0, void 0, 0.01);
    H.P(g, teeth, dark);
  }
  k.bob(head, 0.01, 2);
  return { body, head, top: 2.7 };
};

// ---- 肉くいおとこ：日焼けした肌・長い金髪・うすい桃色のアイシャドウ・白い縞のうすいピンクのえり付きシャツ・うすいベージュのズボン・
//      黒いタップシューズ。花束のかわりに、紙で包んで赤いリボンを結んだ肉のかたまりを持つ ----
HI_MODELS.肉くいおとこ = (k, o, H) => {
  const skin = o.skin ?? 0xc89060, shirt = 0xf2c8cc, pants = 0xe8dcc0, hair = 0xf0d060;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.13, y: 0.96, len: 0.96, r: 0.1, skin: pants, pants, baggy: 1.1, foot: "shoe", footColor: 0x14121a });
  const torso = k.group(body, [0, 0.94, 0]);
  const tprof = [[0, 0], [0.2, 0.01], [0.21, 0.12], [0.2, 0.3], [0.24, 0.5], [0.26, 0.6], [0.2, 0.68], [0.08, 0.72], [0, 0.73]];
  H.O(torso, H.lathe("nikuTorso", tprof, 36, 1.1, 0.75), shirt);
  // 白い縦縞
  H.P(torso, hiGeo("T:nikuStripes", m => { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; m.tube(t => { const y = 0.04 + t * 0.62, r = kRadAt(tprof, y) + 0.004; return [Math.cos(a) * r * 1.1, y, Math.sin(a) * r * 0.75]; }, 0.008, 16, 5); } }), 0xffffff);
  H.P(torso, H.ring, 0x6a4a2a, [0, 0.03, 0], [0.225, 0.25, 0.16]); // ベルト
  // えり（左右の三角）とボタン
  for (const s of [-1, 1]) H.O(torso, H.lathe("collar", [[0.001, 0], [0.07, 0], [0.001, 0.13]], 3, 1, 0.3), shirt, [s * 0.06, 0.64, 0.14], 1, [0.3, 0, s * 0.9], void 0, 0.02);
  for (let i = 0; i < 4; i++) H.P(torso, H.ballS, 0xffffff, [0, 0.5 - i * 0.12, 0.2 - i * 0.004], 0.014);
  const la = hiArm(H, body, -1, { x: 0.28, y: 1.56, len: 0.66, r: 0.075, skin, sleeve: shirt, sleeve2: shirt, hand: "fist", tilt: 0.2 });
  const ra = hiArm(H, body, 1, { x: 0.28, y: 1.56, len: 0.66, r: 0.075, skin, sleeve: shirt, sleeve2: shirt, hand: "fist", tilt: 0.2, bend: 0.9 });
  // 肉の花束：紙の包み・肉（あぶら身の筋）・赤いリボン
  const bq = k.group(ra.hand, [0, 0, 0.04], [Math.PI / 2 - 0.5, 0, 0]);
  H.two(bq, H.lathe("wrapPaper", [[0.02, -0.08], [0.1, 0.12], [0.2, 0.34], [0.22, 0.4]], 20), 0xf4ecd8, [0, 0, 0], 1, [0, 0.3, 0], { flat: 1 });
  H.O(bq, H.ball, 0xb8323a, [0, 0.42, 0], [0.19, 0.14, 0.17]);
  H.P(bq, hiGeo("T:fat", m => { for (let i = 0; i < 4; i++) m.tube(t => [Math.cos(t * 3 + i) * 0.15, 0.04 + Math.sin(t * 5 + i) * 0.05, Math.sin(t * 3 + i) * 0.13], 0.012, 16, 5); }), 0xf6e8e0, [0, 0.42, 0]);
  H.P(bq, H.lathe("bone", [[0, -0.06], [0.04, -0.05], [0.025, 0], [0.025, 0.1], [0.045, 0.14], [0, 0.16]], 12), 0xf8f2e6, [0.12, 0.5, 0], 1, [0, 0, -0.9]);
  H.P(bq, H.ring, 0xd8203a, [0, 0.06, 0], [0.07, 0.3, 0.07]);
  for (const s of [-1, 1]) H.O(bq, H.ball, 0xd8203a, [s * 0.06, 0.06, 0.07], [0.06, 0.035, 0.02], [0, 0, s * 0.5]);
  // 頭：長い金髪・桃色のまぶた
  const head = hiHead(H, body, [0, 1.84, 0.02], { r: 0.2, skin, ear: "round", eyes: { white: 0xffffff, iris: 0x3a2a1a, lid: 0xf4b8a0, lidTilt: -0.1, sy: 0.9 }, brow: 0xd0a840, mouth: "smile" });
  const strands = [];
  for (let i = 0; i < 70; i++) {
    const u = (i * 0.618034) % 1, v = (i * 0.381966) % 1, az = Math.PI * (-0.1 + u * 1.2), el = 0.25 + v * 1.1;
    const base = [Math.cos(az) * Math.cos(el) * 0.2, Math.sin(el) * 0.2 + 0.02, -Math.abs(Math.sin(az)) * Math.cos(el) * 0.19 - 0.02];
    strands.push({ base, dir: [base[0] * 0.6, 0.1, -0.3], len: 0.35 + v * 0.25, r: 0.03, droop: 1.1, curl: (u - 0.5) * 0.04 });
  }
  for (let i = 0; i < 9; i++) strands.push({ base: [(i / 8 - 0.5) * 0.28, 0.17, 0.12], dir: [(i / 8 - 0.5) * 0.6, -0.1, 0.35], len: 0.14, r: 0.028, droop: 1.5 });
  H.P(head, hiHair("niku", strands), hair);
  H.O(head, H.ball, hair, [0, 0.06, -0.02], [0.215, 0.21, 0.21], 0, void 0, 0.02);
  k.bob(head, 0.01, 2);
  return { body, head, top: 2.1 };
};

// ---- さきがけの助：ぶようじん坊の色ちがい。日焼けした肌・黒目・黄色い顔の模様・うすい黄色のおなか・こげ茶の足と手首の輪・
//      白い前かけのふんどし・赤い髪（白いひもで結ぶ）・武器を持つ ----
HI_MODELS.さきがけの助 = (k, o, H) => {
  const skin = o.skin ?? 0xd8a070, belly = 0xf4e4a0, brown = 0x4a2a1a, red = 0xd83a2a, yellow = 0xf2c830;
  const body = k.group(null);
  for (const s of [-1, 1]) {
    hiLeg(H, body, s, { x: 0.13, y: 0.52, len: 0.5, r: 0.1, skin, foot: "bare", footColor: brown }); // こげ茶の足
  }
  const torso = k.group(body, [0, 0.5, 0]);
  H.O(torso, H.lathe("sakiTorso", [[0, 0], [0.2, 0.01], [0.24, 0.12], [0.25, 0.28], [0.23, 0.44], [0.16, 0.54], [0, 0.57]], 32, 1.05, 0.9), skin);
  H.P(torso, H.ball, belly, [0, 0.22, 0.1], [0.2, 0.21, 0.135]);
  // 白いふんどしと前かけ
  H.O(torso, H.lathe("sakiLoin", [[0.24, -0.02], [0.25, 0.04], [0.245, 0.1]], 32, 1.05, 0.9), 0xf6f4ee, 0, 1, 0, void 0, 0.008);
  H.two(torso, hiGeo("L:apron", m => m.latheArc([[0.27, -0.34], [0.265, -0.15], [0.26, 0.04]], Math.PI * 0.3, Math.PI * 0.7, 12, null, 1.05, 0.95)), 0xf6f4ee);
  hiArm(H, body, -1, { x: 0.25, y: 0.98, len: 0.46, r: 0.075, skin, hand: "fist", band: brown });
  const ra = hiArm(H, body, 1, { x: 0.25, y: 0.98, len: 0.46, r: 0.075, skin, hand: "fist", band: brown, bend: 0.5 });
  // 槍（みだれづき）
  const sp = k.group(ra.hand, [0, 0, 0.02], [Math.PI / 2 - 0.2, 0, 0]);
  H.P(sp, H.lathe("spearPole", [[0, -0.5], [0.022, -0.5], [0.022, 0.9], [0, 0.9]], 12), 0x6a4a2a);
  H.P(sp, H.lathe("spearHead", [[0, 0], [0.04, 0], [0.05, 0.08], [0.03, 0.22], [0, 0.3]], 4, 1, 0.3), 0xdfe6f0, [0, 0.9, 0], 1, 0, { glow: 0x202830, flat: 1 });
  H.P(sp, H.ring, red, [0, 0.88, 0], [0.035, 0.3, 0.035]);
  // 頭：黄色い隈取り（目を囲む 2 つ・口の下に 3 本）・赤い髪を白いひもで結ぶ
  const head = hiHead(H, body, [0, 1.25, 0.02], { r: 0.25, skin, ear: "round", eyes: { white: 0xffffff, iris: 0x14101c, irisR: 0.7 }, brow: 0x3a1a10, browTilt: 0.2, mouth: "line" });
  // 隈取り（顔の表面にかく）
  const F = hiOnFace(0.25, 0.27, 0.245, 0.006);
  H.P(head, hiGeo("T:sakiKuma", m => {
    for (const s of [-1, 1]) m.tube(t => { const a = t * Math.PI * 2; return F(s * 0.09 + Math.cos(a) * 0.06, 0.03 + Math.sin(a) * 0.055); }, 0.011, 40, 6);
    for (let i = -1; i <= 1; i++) m.tube(t => F(i * 0.05, -0.15 - t * 0.07), 0.011, 10, 6);
  }), yellow);
  H.O(head, H.ball, red, [0, 0.12, -0.02], [0.26, 0.2, 0.25], 0, void 0, 0.02);
  H.P(head, hiHair("saki", Array.from({ length: 30 }, (_, i) => ({ base: [Math.cos(i * 2.4) * 0.08, 0.26, Math.sin(i * 2.4) * 0.08 - 0.02], dir: [Math.cos(i * 2.4), 1.6, Math.sin(i * 2.4)], len: 0.18 + (i % 4) * 0.03, r: 0.03, droop: 0.4 }))), red);
  H.P(head, H.ring, 0xf6f4ee, [0, 0.27, -0.02], [0.09, 0.3, 0.09]);
  k.bob(head, 0.012, 2.3);
  return { body, head, top: 1.6 };
};

// ---- ミツマタノヅチ：3 つの頭の爬虫類。紫のいぼだらけの肌・まつげのような突起のある青いくちびる・
//      先が黄色いピンクの長い舌をたらし、口の中から ピンクの虹彩の目玉が 1 つのぞく・指 4 本の太い腕・
//      とぐろを巻いた体から藍色の液がしみ出す ----
HI_MODELS.ミツマタノヅチ = (k, o, H) => {
  const skin = o.skin ?? 0x7a4a9a, belly = shade(skin, 0.25), lip = 0x3a6ad8, wart = shade(skin, -0.2), ooze = 0x2a2a8a;
  const body = k.group(null);
  // とぐろ：らせんの太い胴
  const coil = t => { const a = t * Math.PI * 4.2, r = 0.5 - t * 0.22; return [Math.cos(a) * r, 0.14 + t * 0.55, Math.sin(a) * r * 0.85]; };
  H.O(body, H.tube("mitsuCoil", coil, t => 0.2 - t * 0.04, 90, 18), skin, 0, 1, 0, void 0, 0.01);
  // いぼ（体じゅうに散らす）
  H.P(body, hiGeo("B:mitsuWarts", m => { for (let i = 0; i < 90; i++) { const t = (i * 0.618) % 1, a = i * 2.4, p = coil(t), r = 0.2 - t * 0.04; m.ball(5, 7, kXf([p[0] + Math.cos(a) * r * 0.95, p[1] + Math.sin(a) * r * 0.95, p[2] + Math.cos(a * 1.3) * r * 0.3], 0, 0.028 + (i % 3) * 0.01)); } }), wart);
  // 上半身（とぐろの上から立ち上がる）
  const up = t => [Math.sin(t * 1.2) * 0.1, 0.62 + t * 0.62, Math.cos(t * 1.5) * 0.08 - 0.05];
  H.O(body, H.tube("mitsuUp", up, t => 0.22 - t * 0.04, 30, 18), skin, [0.22, 0, 0.1], 1, 0, void 0, 0.01);
  const chest = k.group(body, [0.3, 1.2, 0.12]);
  H.O(chest, H.ball, skin, [0, 0, 0], [0.3, 0.26, 0.24]);
  H.P(chest, H.ball, belly, [0, -0.05, 0.12], [0.22, 0.2, 0.14]);
  H.P(chest, hiGeo("B:mitsuWarts2", m => { for (let i = 0; i < 26; i++) { const a = i * 2.4, v = (i * 0.618) % 1; m.ball(5, 7, kXf([Math.cos(a) * 0.29 * Math.cos(v - 0.5), (v - 0.5) * 0.4, Math.sin(a) * 0.23 * Math.cos(v - 0.5)], 0, 0.025)); } }), wart);
  // 太い腕（指 4 本）
  for (const s of [-1, 1]) hiArm(H, chest, s, { x: 0.28, y: 0.05, len: 0.62, r: 0.1, skin, hand: "open", claw: 0xe8e0c8, tilt: 0.55 });
  // 3 つの首と頭
  let mainHead = null;
  [[-0.2, 0.16, 0.95], [0, 0.26, 0], [0.2, 0.16, -0.95]].forEach(([x, y, rz], i) => {
    const neck = k.group(chest, [x, y, 0], [0, 0, rz]);
    H.O(neck, H.tube("mitsuNeck", t => [0, t * 0.5, Math.sin(t * 2) * 0.12], t => 0.12 - t * 0.03, 16, 14), skin, 0, 1, 0, void 0, 0.01);
    const head = k.group(neck, [0, 0.56, 0.14], [0.1, 0, -rz * 0.75]);
    head.scale.setScalar(1.35);
    H.O(head, H.ball, skin, [0, 0.04, 0], [0.19, 0.17, 0.2]);
    // 上あご・下あご（口を開ける）と青いくちびる
    H.O(head, H.ball, skin, [0, -0.1, 0.03], [0.16, 0.07, 0.17]);
    H.P(head, H.ball, 0x5a1030, [0, -0.04, 0.1], [0.13, 0.06, 0.12]);
    for (const [yy, sc] of [[0.02, 1], [-0.1, 0.9]]) H.O(head, H.lathe("lipRing", [[0.8, -0.2], [1, 0], [0.8, 0.2]], 24, 1, 0.55), lip, [0, yy, 0.13], [0.14 * sc, 0.12, 0.14 * sc], [0.2, 0, 0], void 0, 0.03);
    // くちびるの まつげのような突起
    H.P(head, hiGeo("T:lashes", m => { for (let j = 0; j < 9; j++) { const a = Math.PI * (0.1 + j * 0.1); m.tube(t => [Math.cos(a) * (0.13 + t * 0.05), 0.04 + Math.sin(a) * 0.04 + t * 0.04, 0.2 + t * 0.02], 0.007, 6, 5); } }), 0x14101c);
    // 口の中の目玉（ピンクの虹彩）
    const eg = k.group(head, [0, -0.04, 0.16]);
    H.O(eg, H.ball, 0xfff8f0, [0, 0, 0], 0.07);
    H.P(eg, H.ballS, 0xf06aa8, [0, 0, 0.055], [0.04, 0.04, 0.02]);
    H.P(eg, H.ballS, 0x14101c, [0, 0, 0.066], [0.018, 0.022, 0.01]);
    H.P(eg, H.ballS, 0xffffff, [-0.012, 0.014, 0.072], 0.008, 0, { glow: 0x606060 });
    // 先の黄色い長い舌（よだれ）
    const tg = t => [Math.sin(t * 2) * 0.04, -0.12 - t * 0.28, 0.2 + Math.sin(t * 2.5) * 0.08];
    H.P(head, H.tube("mitsuTongue", tg, t => 0.035 * (1 - t * 0.5), 20, 10, 0.5), 0xf07aa0);
    H.P(head, H.ball, 0xf2d040, tg(1), [0.03, 0.04, 0.02]);
    H.P(head, H.lathe("drip", [[0, 0], [0.4, 0.3], [0.5, 0.6], [0.3, 0.9], [0, 1]], 12), ooze, [0.04, -0.46, 0.25], [0.03, 0.06, 0.03], 0, { alpha: 0.85, glow: 0x0a0a30 });
    k.swing(neck, "z", 0.08, 1.2 + i * 0.3, i);
    if (i === 1) mainHead = head;
  });
  // しみ出る藍色の液（とぐろの下のたまり・しずく）
  H.P(body, H.ball, ooze, [0, 0.01, 0], [0.75, 0.015, 0.65], 0, { alpha: 0.8, glow: 0x08082a });
  H.P(body, hiGeo("B:oozeDrips", m => { for (let i = 0; i < 14; i++) { const p = coil((i * 0.37) % 1); m.lathe([[0, 0], [0.4, 0.25], [0.5, 0.6], [0.3, 0.9], [0, 1]], 10, kXf([p[0] * 1.05, p[1] - 0.2, p[2] * 1.05], 0, [0.035, 0.07, 0.035])); } }), ooze, 0, 1, 0, { alpha: 0.85, glow: 0x0a0a30 });
  return { body, head: mainHead, top: 2.1 };
};

// ---- ばか頭巾：オレンジの帽子の妖怪。厚いくちびるがつばになり、四角い歯がまばらに生える・青いリボン（鼻のかわり）・
//      てっぺんに うずまきの目の目玉が 2 本 ----
HI_MODELS.ばか頭巾 = (k, o, H) => {
  const hat = o.skin ?? 0xe8802a, lip = 0xc86a9a, bow = 0x2a6ad8;
  const body = k.group(null);
  const head = k.group(body, [0, 0, 0]);
  // くちびる（つば）：ぶ厚い輪を上下 2 枚
  H.O(head, H.lathe("bakaLipLo", [[0.2, 0], [0.5, 0.01], [0.58, 0.06], [0.55, 0.12], [0.36, 0.13]], 48), lip, [0, 0.02, 0], 1, 0, void 0, 0.012);
  H.O(head, H.lathe("bakaLipUp", [[0.36, 0], [0.56, 0.02], [0.6, 0.09], [0.52, 0.15], [0.36, 0.16]], 48), lip, [0, 0.2, 0], 1, 0, void 0, 0.012);
  H.P(head, H.lathe("bakaMouth", [[0, 0], [0.4, 0], [0.4, 0.12], [0, 0.12]], 40), 0x3a0a18, [0, 0.12, 0]);
  // まばらな四角い歯
  for (let i = 0; i < 9; i++) { const a = i * 0.72 + 0.3; H.P(head, H.lathe("sqTooth", [[0, 0], [0.7, 0], [0.7, 1], [0, 1]], 4), 0xfff8ee, [Math.cos(a) * 0.46, i % 2 ? 0.15 : 0.1, Math.sin(a) * 0.46], [0.045, 0.06, 0.03], [i % 2 ? Math.PI : 0, -a + Math.PI / 4, 0]); }
  // 帽子の山（オレンジ）
  H.O(head, H.lathe("bakaCrown", [[0.34, 0], [0.36, 0.2], [0.35, 0.45], [0.38, 0.6], [0.36, 0.66], [0.001, 0.68]], 48), hat, [0, 0.34, 0], 1, 0, void 0, 0.012);
  // 青いリボンと、鼻になる結び目
  H.P(head, H.lathe("bakaBand", [[0.366, 0], [0.368, 0.1], [0.366, 0.12]], 48), bow, [0, 0.42, 0]);
  const b = k.group(head, [0, 0.48, 0.37]);
  H.O(b, H.ball, bow, [0, 0, 0], [0.05, 0.05, 0.05]);
  for (const s of [-1, 1]) H.O(b, H.lathe("bowLoop", [[0, 0], [0.06, 0.03], [0.07, 0.1], [0.04, 0.15], [0, 0.16]], 16, 1, 0.45), bow, [s * 0.02, 0, 0], 1, [0, 0, -s * Math.PI / 2], void 0, 0.02);
  // てっぺんの目玉 2 本（うずまきの目）
  for (const s of [-1, 1]) {
    const st = k.group(head, [s * 0.13, 1.0, 0.02], [0, 0, -s * 0.25]);
    H.O(st, H.tube("bakaStalk", t => [0, t * 0.3, Math.sin(t * 2) * 0.04], t => 0.045 - t * 0.012, 12, 10), hat);
    const eg = k.group(st, [0, 0.38, 0.05]);
    H.O(eg, H.ball, 0xffffff, [0, 0, 0], [0.12, 0.13, 0.11]);
    H.P(eg, H.tube("swirl", t => { const a = t * Math.PI * 5, r = 0.085 * t; return [Math.cos(a) * r, Math.sin(a) * r, 0]; }, 0.008, 60, 5), 0x14101c, [0, 0, 0.108]);
    k.swing(st, "z", 0.15, 2.5, s > 0 ? 1 : 0);
  }
  k.bob(head, 0.03, 2.6);
  return { body, head, top: 1.6 };
};

// ---- ひとまか仙人：うす青紫の肌の老人。浮かぶ赤いまくらに寝そべる・大きな耳たぶと鼻・ひげと同じくらい長い額・
//      腕 4 本（3 本は指さし、1 本はほおづえ）・木の杖・茶色の帽子・こけ色の着物・足のかわりに霊のしっぽ・まわりに雲 ----
HI_MODELS.ひとまか仙人 = (k, o, H) => {
  const skin = o.skin ?? 0xa8a4dc, kimono = 0x5a7a3a, red = 0xc8342a, beard = 0xf4f4f0;
  const body = k.group(null);
  // 雲とまくら
  const float = k.group(body, [0, 0.35, 0]);
  for (let i = 0; i < 7; i++) H.O(float, H.ball, 0xf4f4fa, [(i - 3) * 0.19, -0.16 - (i % 2) * 0.04, Math.sin(i * 2) * 0.12], 0.1 + (i % 3) * 0.03, 0, { alpha: 0.95 });
  H.O(float, H.lathe("pillow", [[0, -0.12], [0.5, -0.1], [0.6, 0], [0.5, 0.1], [0, 0.12]], 4, 1.4, 0.7), red, [0, 0, 0], 1, [0, Math.PI / 4, 0], void 0, 0.01);
  for (const x of [-1, 1]) for (const z of [-1, 1]) H.P(float, H.ballS, 0xe8c04a, [x * 0.58, 0, z * 0.33], 0.035);
  k.bob(float, 0.04, 1.4);
  // 寝そべる体：着物の胴（横向き）と霊のしっぽ
  const lie = k.group(float, [0, 0.2, 0]);
  H.O(lie, H.lathe("sennTorso", [[0, 0], [0.2, 0.02], [0.26, 0.2], [0.24, 0.45], [0.16, 0.58], [0, 0.6]], 32, 1, 0.85), kimono, [-0.1, 0.02, 0], 1, [0, 0, -Math.PI / 2 + 0.25]);
  H.O(lie, H.tube("ghostTail", t => [0.1 + t * 0.55, -0.05 + Math.sin(t * 3) * 0.08, Math.sin(t * 5) * 0.05], t => 0.22 * (1 - t) + 0.01, 24, 16), shade(skin, 0.15), [0, 0, 0], 1, 0, { alpha: 0.9 });
  H.P(lie, H.tube("sennObi", t => [0, Math.cos(t * Math.PI * 2) * 0.25, Math.sin(t * Math.PI * 2) * 0.21], 0.03, 30, 6), 0xe8c04a, [0.02, 0.02, 0]);
  // 頭：長い額・大きな鼻と耳たぶ・長いひげ・茶色の帽子（ほおづえの手にのる）
  const head = k.group(lie, [-0.58, 0.3, 0.05], [0, 0.35, 0.2]);
  head.scale.setScalar(0.78);
  H.O(head, H.ball, skin, [0, 0.12, 0], [0.2, 0.34, 0.2]);
  H.P(head, H.ball, skin, [0, -0.12, 0.05], [0.18, 0.14, 0.17]);
  H.P(head, H.ball, shade(skin, -0.05), [0, -0.06, 0.22], [0.06, 0.08, 0.07]);
  for (const s of [-1, 1]) {
    H.O(head, H.ball, skin, [s * 0.2, -0.08, 0], [0.05, 0.15, 0.07]);
    H.P(head, H.tube("sennBrow", t => [t * 0.08, -t * t * 0.08, 0], 0.018, 10, 6), beard, [s * 0.05, 0.08, 0.19], [s, 1, 1]);
  }
  hiEyes(H, head, { x: 0.075, y: 0.03, z: 0.17, r: 0.04, white: 0xffffff, iris: 0x14101c, irisR: 0.6, lid: skin, lidY: 0.35, sy: 0.8 });
  H.P(head, H.tube("sennBeard", t => [Math.sin(t * 2) * 0.05, -0.14 - t * 0.38, 0.14 + t * 0.08], t => 0.09 * (1 - t) + 0.01, 20, 12), beard);
  H.O(head, H.dome, 0x7a4a2a, [0, 0.36, 0], [0.16, 0.1, 0.16], 0, void 0, 0.04);
  H.P(head, H.ring, 0x5a3a1a, [0, 0.365, 0], [0.16, 0.2, 0.16]);
  // 腕 4 本：左手 1 本はほおづえ、3 本は指さし（1 本は杖）
  const prop = k.group(lie, [-0.52, 0.12, 0.05]);
  H.O(prop, H.seg("upper", 0.22, 0.05), kimono, [0, 0, 0], 1, [0, 0, -2.6]);
  H.O(prop, H.ball, skin, [-0.12, 0.18, 0], 0.06);
  const arms = [];
  [[-0.3, 0.2, 0.18, 1.3], [-0.2, 0.18, -0.16, 1.1], [-0.36, 0.26, 0.02, 1.6]].forEach(([x, y, z, rz], i) => {
    const g = k.group(lie, [x, y, z]);
    const a = hiArm(H, g, 1, { x: 0, y: 0, len: 0.42, r: 0.045, skin, sleeve: kimono, cuff: "bell", hand: "open", tilt: rz, bend: 0.2 });
    arms.push(a);
  });
  // 杖（1 本目の手）
  const staff = k.group(arms[0].hand, [0, 0, 0.02], [Math.PI / 2 - 0.3, 0, 0]);
  H.P(staff, H.tube("sennStaff", t => [Math.sin(t * 9) * 0.015, -0.3 + t * 1.1, Math.cos(t * 7) * 0.012], 0.018, 40, 8), 0x7a5a2a);
  H.O(staff, H.ball, 0x6a4a22, [0, 0.82, 0], [0.05, 0.06, 0.05]);
  // 雲の粒
  for (let i = 0; i < 4; i++) { const c = k.group(body, [Math.cos(i * 1.6) * 0.8, 0.9 + (i % 2) * 0.3, Math.sin(i * 1.6) * 0.5]); H.P(c, H.ball, 0xf8f8ff, [0, 0, 0], [0.12, 0.07, 0.08], 0, { alpha: 0.85 }); H.P(c, H.ball, 0xf8f8ff, [0.1, 0.02, 0], [0.08, 0.05, 0.06], 0, { alpha: 0.85 }); k.bob(c, 0.05, 1 + i * 0.2); }
  return { body, head, top: 1.4 };
};

// ---- 草くいおとこ：うすいミント色の肌・帽子のかげの小さな赤い目・灰色から青緑へ変わる とても長い髪・
//      灰色のひもを巻いた茶色の帽子・青緑の着物に無地の黄色い帯・黒い鼻緒のベージュのぞうり・緑の葉を食べている ----
HI_MODELS.草くいおとこ = (k, o, H) => {
  const skin = o.skin ?? 0xcdeede, kimono = 0x2a8a86, obi = 0xf2d040;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.1, y: 0.9, len: 0.9, r: 0.08, skin, foot: "zori", footColor: 0xe8dcc0, strap: 0x14121a });
  hiRobeSkirt(H, body, "kusa", 0.98, 0.24, 0.3, 0.78, kimono, { hem: shade(kimono, -0.3) });
  const torso = k.group(body, [0, 0.9, 0]);
  H.O(torso, H.lathe("kusaTorso", [[0, 0], [0.22, 0.02], [0.23, 0.2], [0.24, 0.45], [0.25, 0.58], [0.18, 0.66], [0.07, 0.7], [0, 0.71]], 36, 1.05, 0.8), kimono);
  H.O(torso, H.lathe("kusaObi", [[0.245, 0.06], [0.25, 0.14], [0.245, 0.24]], 36, 1.05, 0.8), obi, 0, 1, 0, void 0, 0.006);
  for (const s of [-1, 1]) H.P(torso, H.tube("eri", t => [s * (0.03 + t * 0.12), 0.7 - t * 0.35, 0.16 + t * 0.03], 0.02, 12, 6), shade(kimono, -0.3));
  H.P(torso, H.ball, skin, [0, 0.62, 0.1], [0.07, 0.07, 0.04]);
  hiArm(H, body, -1, { x: 0.26, y: 1.5, len: 0.62, r: 0.07, skin, sleeve: kimono, cuff: "bell", hand: "fist", tilt: 0.2 });
  const ra = hiArm(H, body, 1, { x: 0.26, y: 1.5, len: 0.62, r: 0.07, skin, sleeve: kimono, cuff: "bell", hand: "fist", tilt: 0.1, bend: 1.9, rx: -0.3 });
  // 口もとへ運ぶ緑の葉
  const leaf = k.group(ra.hand, [0, -0.02, 0.06], [0.4, 0, 0.3]);
  H.O(leaf, H.lathe("leaf", [[0, 0], [0.05, 0.03], [0.07, 0.1], [0.05, 0.17], [0, 0.22]], 16, 1, 0.12), 0x5ab84a, [0, 0, 0], 1, 0, void 0, 0.01);
  H.P(leaf, H.tube("leafVein", t => [0, t * 0.24 - 0.02, 0.01], 0.004, 8, 4), 0x3a8a2a);
  // 頭：帽子のかげの小さな赤い目
  const head = hiHead(H, body, [0, 1.76, 0.02], { r: 0.19, skin, ear: "round", eyes: { white: 0x14101c, iris: 0xd8303a, irisR: 0.5, irisGlow: 0x400808, r: 0.028, pupilKind: "none", hl: false }, mouth: "open" });
  // とても長い髪（上は灰色、下へいくほど青緑）
  const hairStr = (from, to, r) => Array.from({ length: 60 }, (_, i) => {
    const a = Math.PI * (-0.15 + ((i * 0.618) % 1) * 1.3), L0 = 0.3 + ((i * 7) % 5) * 0.03;
    const base = [Math.cos(a) * 0.18, 0.05 - from * 0.9, -Math.abs(Math.sin(a)) * 0.17];
    return { base, dir: [Math.cos(a) * 0.2, -1, -Math.abs(Math.sin(a)) * 0.3 - 0.15], len: (to - from) * 0.9 + L0 * (to > 0.99 ? 1 : 0), r: r, droop: 0, taper: to > 0.99 ? 0.9 : 0.05 };
  });
  H.O(head, H.ball, 0x9a9aa4, [0, 0.04, -0.02], [0.2, 0.2, 0.2], 0, void 0, 0.02);
  H.P(head, hiHair("kusa1", hairStr(0, 0.35, 0.035)), 0x9a9aa4);
  H.P(head, hiHair("kusa2", hairStr(0.35, 0.7, 0.032)), 0x6aaab0);
  H.P(head, hiHair("kusa3", hairStr(0.7, 1.0, 0.03)), 0x2a9aa0);
  // 茶色の帽子と灰色のひも（目にかげを落とす深さ）
  H.O(head, H.lathe("kusaHat", [[0.001, 0.26], [0.16, 0.25], [0.2, 0.12], [0.21, 0.04], [0.34, 0.0], [0.35, -0.02], [0.2, -0.01]], 40), 0x7a5230, [0, 0.08, 0], 1, [0.12, 0, 0], void 0, 0.008);
  H.P(head, H.lathe("kusaHatBand", [[0.206, 0.05], [0.21, 0.09], [0.202, 0.12]], 40), 0x4a4a52, [0, 0.08, 0], 1, [0.12, 0, 0]);
  k.bob(head, 0.008, 1.6);
  return { body, head, top: 2.1 };
};

// ---- ガマンモス：大きな赤いゾウ。マンモスの牙と毛・鼻に木の栓がつまっている（ガマンの妖怪）----
HI_MODELS.ガマンモス = (k, o, H) => {
  const skin = o.skin ?? 0xc84a3a, hair = shade(skin, -0.45), tusk = 0xf6f0e0;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.3, y: 0.62, len: 0.62, r: 0.2, skin, foot: "shoe", footColor: shade(skin, -0.15) });
  const torso = k.group(body, [0, 0.55, 0]);
  const tp = [[0, 0], [0.4, 0.02], [0.55, 0.25], [0.58, 0.55], [0.52, 0.85], [0.36, 1.0], [0, 1.05]];
  H.O(torso, H.lathe("gamaTorso", tp, 40, 1.05, 0.9), skin);
  H.P(torso, H.ball, shade(skin, 0.15), [0, 0.42, 0.25], [0.4, 0.38, 0.3]);
  // 背中と肩のマンモスの毛
  H.P(torso, hiHair("gamaBack", Array.from({ length: 70 }, (_, i) => {
    const a = Math.PI * (0.05 + ((i * 0.618) % 1) * 0.9) + Math.PI, y = 0.5 + ((i * 0.381) % 1) * 0.5;
    const r = kRadAt(tp, y);
    return { base: [Math.cos(a) * r * 1.05, y, Math.sin(a) * r * 0.9], dir: [Math.cos(a) * 0.4, -0.3, Math.sin(a) * 0.6], len: 0.25 + (i % 4) * 0.05, r: 0.04, droop: 0.6 };
  })), hair);
  for (const s of [-1, 1]) hiArm(H, body, s, { x: 0.6, y: 1.35, len: 0.72, r: 0.15, skin, hand: "mitt", tilt: 0.35 });
  // 頭：大きな耳・黄色い丸い目・太い眉・牙・栓をした鼻
  const head = k.group(body, [0, 1.78, 0.18]);
  H.O(head, H.ball, skin, [0, 0, 0], [0.42, 0.4, 0.38]);
  H.P(head, hiHair("gamaTop", Array.from({ length: 40 }, (_, i) => { const a = i * 2.4, r = 0.2 * Math.sqrt((i + 0.5) / 40); return { base: [Math.cos(a) * r, 0.36, Math.sin(a) * r - 0.05], dir: [Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5 - 0.3], len: 0.22, r: 0.035, droop: 0.9 }; })), hair);
  for (const s of [-1, 1]) {
    const ear = k.group(head, [s * 0.38, 0.02, -0.05], [0, s * 0.5, 0]);
    H.O(ear, H.ball, skin, [s * 0.22, 0, 0], [0.26, 0.32, 0.05]);
    H.P(ear, H.ball, shade(skin, 0.2), [s * 0.22, 0, 0.02], [0.19, 0.24, 0.04]);
    k.swing(ear, "y", 0.12, 1.8, s > 0 ? 0 : 1);
    // マンモスの牙：下へ出て、前から上へ大きく反る
    const tg = k.group(head, [s * 0.16, -0.2, 0.26]);
    tg.scale.set(s, 1, 1);
    H.O(tg, H.tube("mammothTusk2", t => [0.05 + Math.sin(t * 2.2) * 0.32, -Math.sin(t * 2.6) * 0.3 + t * t * 0.5, t * 0.35 - t * t * 0.15], t => 0.075 * (1 - t * 0.75), 36, 14), tusk, 0, 1, 0, void 0, 0.01);
  }
  hiEyes(H, head, { x: 0.17, y: 0.1, z: 0.33, r: 0.08, white: 0xf2d040, iris: 0x14101c, irisR: 0.4, lid: skin, lidTilt: 0.35, lidY: 0.7 });
  for (const s of [-1, 1]) H.P(head, H.tube("gamaBrow", t => [t * 0.14, t * 0.04, 0], 0.03, 10, 8), hair, [s * 0.08, 0.22, 0.37], [s, 1, 1], [0, 0, -s * 0.35]);
  // 鼻：太い根もとから前へ垂れて、先に木の栓
  const tr = t => [0, -0.05 - t * 0.55 + t * t * 0.2, 0.3 + Math.sin(t * 2) * 0.22];
  H.O(head, H.tube("gamaTrunk", tr, t => 0.14 - t * 0.07, 30, 16), skin, 0, 1, 0, void 0, 0.01);
  H.P(head, hiGeo("T:trunkRings", m => { for (let i = 1; i < 8; i++) { const p = tr(i / 8); m.tube(t => [p[0] + Math.cos(t * Math.PI * 2) * (0.145 - i / 8 * 0.07), p[1], p[2] + Math.sin(t * Math.PI * 2) * (0.145 - i / 8 * 0.07)], 0.008, 20, 5); } }), shade(skin, -0.2));
  const plug = tr(1);
  H.O(head, H.lathe("plug", [[0, -0.02], [0.07, -0.02], [0.085, 0.08], [0, 0.09]], 20), 0xa87a48, [plug[0], plug[1] - 0.02, plug[2]], 1, [0.5, 0, 0], void 0, 0.01);
  k.bob(head, 0.01, 1.8);
  return { body, head, top: 2.3 };
};
// ---- 大ガマ：うすいベージュの肌・海の青の顔の模様・長い黒髪を赤い髪ひもで結んだポニーテール（先はくすんだ赤の玉）・
//      金の綿毛の縁の緑の羽織・同じ綿毛の黄緑の短い着物を赤橙の帯でしめる・緑のズボン・水色の足袋・ぞうり ----
HI_MODELS.大ガマ = (k, o, H) => {
  const skin = o.skin ?? 0xf0dcc0, haori = 0x3a7a3a, kimono = 0xa8d850, pants = 0x2f6a3a, fluff = 0xe8c04a, obi = 0xe8602a;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.13, y: 0.95, len: 0.95, r: 0.1, skin, pants, baggy: 1.35, cuffR: 1.0, foot: "zori", footColor: 0xe8d8b8, strap: 0xc83a2a, sock: 0x9ad0f0 });
  const torso = k.group(body, [0, 0.92, 0]);
  const tp = [[0, 0], [0.22, 0.02], [0.24, 0.2], [0.25, 0.45], [0.28, 0.58], [0.2, 0.68], [0.08, 0.72], [0, 0.73]];
  H.O(torso, H.lathe("gamaDTorso", tp, 36, 1.1, 0.8), kimono);
  // 短い着物のすそ（綿毛の縁）と赤橙の帯
  H.two(torso, H.sleeve("gamaDSkirt", [[0.3, -0.18], [0.27, -0.05], [0.25, 0.05]], 36), kimono, [0, 0, 0], [1.1, 1, 0.85]);
  H.P(torso, hiGeo("B:fluffHem", m => { for (let i = 0; i < 26; i++) { const a = i / 26 * Math.PI * 2; m.ball(5, 7, kXf([Math.cos(a) * 0.31 * 1.1, -0.18, Math.sin(a) * 0.31 * 0.85], 0, 0.04)); } }), fluff);
  H.O(torso, H.lathe("gamaDObi", [[0.255, 0.05], [0.26, 0.14], [0.255, 0.22]], 36, 1.1, 0.8), obi, 0, 1, 0, void 0, 0.006);
  // 羽織（前が開いた外側の着物）と、えりの金の綿毛
  H.two(torso, hiGeo("L:haori", m => m.latheArc([[0.33, -0.3], [0.3, 0.0], [0.29, 0.3], [0.3, 0.55], [0.22, 0.68]], Math.PI * 0.5 + 0.45, Math.PI * 2.5 - 0.45, 30, null, 1.1, 0.85)), haori);
  H.P(torso, hiGeo("B:fluffCollar", m => { for (let i = 0; i < 22; i++) { const t = i / 21, s = t < 0.5 ? -1 : 1, u = t < 0.5 ? t * 2 : (1 - t) * 2; m.ball(5, 7, kXf([s * (0.08 + (1 - u) * 0.18), 0.7 - (1 - u) * 0.95, 0.2 + u * 0.02], 0, 0.045)); } }), fluff);
  hiArm(H, body, -1, { x: 0.28, y: 1.52, len: 0.64, r: 0.07, skin, sleeve: haori, cuff: "bell", hand: "fist", tilt: 0.22 });
  hiArm(H, body, 1, { x: 0.28, y: 1.52, len: 0.64, r: 0.07, skin, sleeve: haori, cuff: "bell", hand: "fist", tilt: 0.22 });
  // 頭：横に広い口・青い模様・後ろで結んだ長い黒髪
  const head = hiHead(H, body, [0, 1.84, 0.02], { r: 0.2, skin, jawW: 0.85, ear: "round", eyes: { white: 0xffffff, iris: 0x2a2a1a, irisR: 0.55, lid: skin, lidTilt: 0.15, lidY: 0.6 }, brow: 0x1c1820, browTilt: 0.15, mouth: "smile" });
  for (const s of [-1, 1]) for (let i = 0; i < 2; i++) H.P(head, H.tube("gamaMark", t => [t * 0.1, -t * 0.03, -t * t * 0.03], t => 0.012 * Math.sin(Math.PI * t) + 0.003, 12, 6), 0x2a7ad8, [s * (0.05 + i * 0.02), -0.04 - i * 0.04, 0.19], [s, 1, 1]);
  H.O(head, H.ball, 0x1c1820, [0, 0.05, -0.02], [0.21, 0.2, 0.21], 0, void 0, 0.02);
  H.P(head, hiHair("gamaFront", Array.from({ length: 10 }, (_, i) => ({ base: [(i / 9 - 0.5) * 0.3, 0.17, 0.12], dir: [(i / 9 - 0.5) * 0.8, -0.4, 0.5], len: 0.12, r: 0.03, droop: 0.8 }))), 0x1c1820);
  const tail = k.group(head, [0, 0.12, -0.2]);
  H.P(tail, H.ring, 0xd83a2a, [0, 0, 0], [0.05, 0.3, 0.05], [Math.PI / 2 - 0.3, 0, 0]);
  const pt = t => [Math.sin(t * 2) * 0.05, -t * 0.7 + Math.sin(t * 3) * 0.05, -0.05 - t * 0.2];
  H.O(tail, H.tube("gamaPony", pt, t => 0.06 * (1 - t * 0.5), 24, 12), 0x1c1820, 0, 1, 0, void 0, 0.01);
  H.O(tail, H.ball, 0xa83a3a, pt(1), [0.07, 0.09, 0.07]);
  k.swing(tail, "x", 0.12, 1.6);
  k.bob(head, 0.01, 2);
  return { body, head, top: 2.15 };
};

// ---- から傘お化け：赤い油紙の傘（先は茶色）・細長い白い顔・白い腕 2 本・緑の目 1 つ・うす紫の舌を出す・
//      一本足に黒い鼻緒の うす茶の一本歯げた ----
HI_MODELS.から傘お化け = (k, o, H) => {
  const paper = o.skin ?? 0xc83a34, white = 0xf6f4ee;
  const body = k.group(null);
  // 一本足と一本歯げた
  const leg = k.group(body, [0, 0.12, 0]);
  H.O(leg, H.seg("shin", 0.5, 0.07), white, [0, 0.5, 0]);
  H.O(leg, H.ball, white, [0, 0.03, 0.05], [0.07, 0.04, 0.1]);
  H.O(leg, H.lathe("geta", [[0, 0], [1, 0], [1, 0.12], [0, 0.14]], 4, 1, 1.8), 0xc8a070, [0, -0.02, 0.04], [0.12, 0.2, 0.08], [0, Math.PI / 4, 0], void 0, 0.05);
  H.O(leg, H.lathe("getaTooth", [[0, 0], [1, 0], [1, 1], [0, 1]], 4), 0xa88050, [0, -0.13, 0.04], [0.08, 0.11, 0.02], [0, Math.PI / 4, 0], void 0, 0.05);
  H.P(leg, H.tube("hanao1", t => [Math.cos(t * Math.PI) * 0.06, 0.03 + Math.sin(t * Math.PI) * 0.03, 0.08 - Math.sin(t * Math.PI) * 0.04], 0.01, 12, 6), 0x14121a);
  // 傘：骨の入った円すい（少し閉じた形）。骨ごとに紙がたるむ
  const umb = k.group(body, [0, 0.62, 0]);
  const N = 12, cone = hiGeo("L:karakasa", m => {
    const rows = 16;
    m.grid(rows + 1, N * 6, (i, j) => { const t = i / rows, a = -j / (N * 6) * Math.PI * 2, sag = 1 - 0.07 * Math.pow(Math.sin(((j % 6) / 6) * Math.PI), 1) * Math.sin(Math.PI * t); const r = (0.62 * (1 - t) + 0.02) * sag * (1 - 0.08 * t * t); return [Math.cos(a) * r, t * 1.05 + Math.sin(t * Math.PI) * 0.04, Math.sin(a) * r]; });
  });
  H.O(umb, cone, paper, [0, 0, 0], 1, 0, void 0, 0.012).material.side = 2;
  H.P(umb, hiGeo("T:ribs", m => { for (let j = 0; j < N; j++) { const a = -j / N * Math.PI * 2; m.tube(t => [Math.cos(a) * (0.62 * (1 - t) + 0.03), t * 1.05 + Math.sin(t * Math.PI) * 0.04, Math.sin(a) * (0.62 * (1 - t) + 0.03)], 0.01, 16, 5); } }), shade(paper, -0.35));
  H.P(umb, H.ring, 0xf2e8d0, [0, 0.52, 0], [0.34, 0.25, 0.34]);
  H.O(umb, H.lathe("karaTip", [[0, 0], [0.06, 0], [0.05, 0.1], [0.02, 0.2], [0, 0.22]], 16), 0x6a4020, [0, 1.04, 0]);
  // 細長い白い顔・緑の目 1 つ・うす紫の舌
  const head = k.group(umb, [0, 0.36, 0.43]);
  head.scale.setScalar(1.45);
  H.O(head, H.ball, white, [0, 0, 0], [0.14, 0.3, 0.06], [-0.5, 0, 0], void 0, 0.04);
  const eg = k.group(head, [0, 0.08, 0.05], [-0.5, 0, 0]);
  H.O(eg, H.ball, 0xffffff, [0, 0, 0], [0.09, 0.1, 0.05]);
  H.P(eg, H.ballS, 0x3ab04a, [0, 0, 0.035], [0.055, 0.06, 0.025]);
  H.P(eg, H.ballS, 0x0a0a0a, [0, 0, 0.05], [0.025, 0.03, 0.015]);
  H.P(eg, H.ballS, 0xffffff, [-0.02, 0.025, 0.058], 0.012, 0, { glow: 0x606060 });
  H.P(head, H.ball, 0x5a1020, [0, -0.13, 0.1], [0.06, 0.04, 0.03], [-0.5, 0, 0]);
  H.O(head, H.tube("karaTongue", t => [Math.sin(t * 2) * 0.02, -0.14 - t * 0.2, 0.12 + t * 0.12], t => 0.035 * (1 - t * 0.4), 16, 10, 0.45), 0xc8a0e0, 0, 1, 0, void 0, 0.01);
  // 白い腕 2 本（傘の横から）
  for (const s of [-1, 1]) hiArm(H, umb, s, { x: 0.42, y: 0.3, len: 0.42, r: 0.045, skin: white, hand: "open", tilt: 0.9, shoulder: false });
  k.bob(umb, 0.02, 2.4);
  return { body, head, top: 1.9 };
};

// ---- ドケチング：凶悪入道の色ちがい。くすんだ緑の肌・黄色い目・白い髪と長いひげ・小さな角のあるひょうたん形の頭・
//      茶と黒の僧の衣・こげ茶のねじれた木の杖・浮かぶ紫のざぶとんにあぐらで座る ----
HI_MODELS.ドケチング = (k, o, H) => {
  const skin = o.skin ?? 0x8aa070, robeB = 0x6a4428, robeK = 0x1c1a20, white = 0xf4f4f0;
  const body = k.group(null);
  const float = k.group(body, [0, 0.3, 0]);
  H.O(float, H.lathe("zabuton", [[0, -0.07], [0.45, -0.06], [0.52, 0], [0.45, 0.06], [0, 0.07]], 4, 1, 1), 0x6a3a9a, [0, 0, 0], 1, [0, Math.PI / 4, 0], void 0, 0.01);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; H.P(float, H.ballS, 0xe8c04a, [Math.cos(a) * 0.5, 0.02, Math.sin(a) * 0.5], [0.04, 0.02, 0.04]); }
  k.bob(float, 0.04, 1.3);
  // あぐら：ひざが横に張り出す（衣でおおう）
  const sit = k.group(float, [0, 0.07, 0]);
  H.O(sit, H.ball, robeB, [0, 0.12, 0.05], [0.46, 0.14, 0.34]);
  for (const s of [-1, 1]) {
    H.O(sit, H.ball, robeB, [s * 0.3, 0.1, 0.18], [0.2, 0.12, 0.18]);
    H.O(sit, H.ball, skin, [s * 0.12, 0.08, 0.34], [0.1, 0.05, 0.07]);
    H.P(sit, H.lathe("zoriS", [[0, 0], [1, 0], [1, 0.2], [0, 0.22]], 20, 0.6, 1), 0xd8c89a, [s * 0.12, 0.03, 0.34], [0.12, 0.1, 0.1]);
  }
  // 胴：黒と茶の衣（左右で色を分ける僧衣）
  const torso = k.group(sit, [0, 0.16, 0]);
  const tp = [[0, 0], [0.3, 0.02], [0.32, 0.2], [0.3, 0.42], [0.24, 0.54], [0.1, 0.6], [0, 0.61]];
  H.O(torso, H.lathe("dokeTorso", tp, 36, 1.05, 0.85), robeK);
  H.two(torso, hiGeo("L:kesa", m => m.latheArc(tp.slice(1, 5).map(([r, y]) => [r + 0.02, y]), Math.PI * 0.2, Math.PI * 1.1, 24, null, 1.05, 0.85)), robeB);
  H.P(torso, H.tube("kesaBelt", t => [Math.cos(0.6 + t * 2.4) * 0.34, 0.55 - t * 0.45, Math.sin(0.6 + t * 2.4) * 0.29], 0.025, 20, 6), 0xe8c04a);
  hiArm(H, torso, -1, { x: 0.3, y: 0.5, len: 0.55, r: 0.07, skin, sleeve: robeK, cuff: "bell", hand: "fist", tilt: 0.4, bend: 1.0 });
  const ra = hiArm(H, torso, 1, { x: 0.3, y: 0.5, len: 0.55, r: 0.07, skin, sleeve: robeB, cuff: "bell", hand: "fist", tilt: 0.3, bend: 0.3 });
  const staff = k.group(ra.hand, [0, 0, 0.02], [0.1, 0, 0]);
  H.P(staff, H.tube("dokeStaff", t => [Math.sin(t * 11) * 0.02, -0.5 + t * 1.4, Math.cos(t * 8) * 0.02], t => 0.024 + Math.sin(t * 17) * 0.004, 60, 8), 0x4a2e18);
  H.O(staff, H.tube("dokeStaffTop", t => [Math.cos(t * 5) * 0.08 * t, 0.9 + t * 0.12, Math.sin(t * 5) * 0.08 * t], 0.028, 24, 8), 0x4a2e18);
  // 頭：ひょうたん形（上に小さな頭・下に大きなあご）・小さな角 2 本・黄色いたて目・白い髪と長いひげ
  const head = k.group(torso, [0, 0.78, 0.04]);
  H.O(head, H.ball, skin, [0, -0.02, 0], [0.22, 0.2, 0.21]);
  H.O(head, H.ball, skin, [0, 0.24, -0.02], [0.15, 0.17, 0.15]);
  for (const s of [-1, 1]) H.O(head, H.tube("dokeHorn", t => [s * t * 0.04, t * 0.1, 0], t => 0.028 * (1 - t) + 0.003, 10, 8), 0xe8dcc0, [s * 0.07, 0.36, 0], 1, 0, void 0, 0.01);
  hiEyes(H, head, { x: 0.08, y: 0.03, z: 0.18, r: 0.045, white: 0xf2d040, iris: 0xf2d040, irisR: 0.3, pupilKind: "slit", lid: skin, lidTilt: 0.4, lidY: 0.5 });
  H.P(head, H.ball, shade(skin, -0.08), [0, -0.05, 0.2], [0.04, 0.06, 0.04]);
  for (const s of [-1, 1]) H.P(head, H.tube("dokeHairSide", t => [s * (0.19 + t * 0.03), 0.02 - t * 0.25, -0.05 - t * 0.05], t => 0.05 * (1 - t) + 0.01, 12, 10), white);
  H.P(head, hiHair("dokeBeard", Array.from({ length: 36 }, (_, i) => { const a = Math.PI * (0.15 + ((i * 0.618) % 1) * 0.7); return { base: [Math.cos(a) * 0.17, -0.12, Math.sin(a) * 0.15], dir: [Math.cos(a) * 0.2, -1, 0.35], len: 0.35 + (i % 5) * 0.04, r: 0.035, droop: -0.1 }; })), white);
  H.P(head, H.tube("dokeMouth", t => [(t - 0.5) * 0.12, -Math.sin(t * Math.PI) * -0.02, 0], 0.01, 12, 6), 0x2a1018, [0, -0.1, 0.205]);
  return { body, head, top: 1.6 };
};

// ---- しどろもどろ：ぼーっとしたゴースト（ダイズの色ちがい）。青い肌・顔は だ円の穴が 3 つ（目と口）・うす紫のほお ----
HI_MODELS.しどろもどろ = (k, o, H) => {
  const skin = o.skin ?? 0x7ab0e0;
  const body = k.group(null);
  const g = k.group(body, [0, 0.25, 0]);
  // 頭から下へすぼまり、先がくるりと巻く霊の体
  const prof = [[0.001, 1.25], [0.2, 1.22], [0.34, 1.1], [0.4, 0.9], [0.38, 0.65], [0.3, 0.45], [0.2, 0.3], [0.12, 0.18]];
  H.O(g, H.lathe("sidoBody", prof, 40, 1, 0.9), skin);
  H.O(g, H.tube("sidoTail", t => [Math.sin(t * 3) * 0.12, 0.2 - t * 0.2 + t * t * 0.1, -t * 0.25], t => 0.12 * (1 - t) + 0.01, 24, 14), skin, 0, 1, 0, void 0, 0.01);
  // 顔：だ円の穴 3 つ（目 2・口 1）と、うす紫のほお
  for (const s of [-1, 1]) {
    H.P(g, H.ball, 0x14101c, [s * 0.13, 0.92, 0.33], [0.055, 0.09, 0.05], [0, s * 0.35, 0]);
    H.P(g, H.ball, 0xc8a8e8, [s * 0.24, 0.78, 0.3], [0.07, 0.045, 0.04], [0, s * 0.6, 0]);
  }
  H.P(g, H.ball, 0x14101c, [0, 0.72, 0.36], [0.05, 0.08, 0.05]);
  // 小さな腕（たれ下がる）
  for (const s of [-1, 1]) hiArm(H, g, s, { x: 0.34, y: 0.75, len: 0.3, r: 0.05, skin, hand: "mitt", tilt: 0.5, shoulder: false });
  k.bob(g, 0.06, 1.2);
  return { body, head: g, top: 1.6 };
};

// ---- びきゃく：黒いかげのような小さな体に、うす紫の垂れ布のついたベージュの笠。棒の先に赤いひもで結んだ黒い包み。
//      見える手足は うすい肌色の脚が 2 本だけで、赤紫のハイヒールをはく ----
HI_MODELS.びきゃく = (k, o, H) => {
  const leg = 0xf4d4c0, heel = 0xd8307a;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.08, y: 0.78, len: 0.8, r: 0.075, skin: leg, foot: "heel", footColor: heel, splay: 0.02 });
  // 影の体（笠の下）と光る目
  const g = k.group(body, [0, 0.8, 0]);
  H.O(g, H.ball, 0x14101c, [0, 0.2, 0], [0.26, 0.28, 0.24]);
  for (const s of [-1, 1]) H.P(g, H.ball, 0xfff4c0, [s * 0.08, 0.26, 0.21], [0.035, 0.045, 0.02], 0, { glow: 0x807040 });
  // 笠とうす紫の垂れ布（横とうしろ）
  H.O(g, H.lathe("bikyakuKasa", [[0.001, 0.2], [0.08, 0.18], [0.3, 0.06], [0.44, 0.0], [0.45, -0.02], [0.001, 0.02]], 40), 0xe8d8b0, [0, 0.4, 0], 1, 0, void 0, 0.008);
  H.P(g, hiGeo("T:kasaLines", m => { for (let j = 0; j < 16; j++) { const a = j / 16 * Math.PI * 2; m.tube(t => [Math.cos(a) * (0.08 + t * 0.36), 0.18 - t * 0.18 + 0.004, Math.sin(a) * (0.08 + t * 0.36)], 0.004, 8, 4); } }), 0xb8a880, [0, 0.4, 0]);
  const drape = hiGeo("L:bikyakuDrape", m => m.latheArc([[0.42, -0.5], [0.4, -0.25], [0.41, 0.0]], Math.PI * 0.5 + 0.55, Math.PI * 2.5 - 0.55, 36));
  const d = H.two(g, drape, 0xc8a8e0, [0, 0.4, 0]);
  d.material.transparent = true; d.material.opacity = 0.92; d.material.userData.baseOpacity = 0.92;
  // 肩にかついだ棒と黒い包み
  const pole = k.group(g, [0.12, 0.25, 0.05], [0, 0, -0.9]);
  H.P(pole, H.lathe("pole", [[0, -0.1], [0.018, -0.1], [0.018, 0.7], [0, 0.7]], 10), 0x8a6a3a);
  const pack = k.group(pole, [0, 0.72, 0]);
  H.O(pack, H.ball, 0x1c1a24, [0, -0.12, 0], [0.15, 0.13, 0.14]);
  H.P(pack, H.ring, 0xd8203a, [0, -0.03, 0], [0.06, 0.2, 0.06]);
  for (const s of [-1, 1]) H.O(pack, H.ball, 0x1c1a24, [s * 0.06, 0.02, 0], [0.05, 0.03, 0.03], [0, 0, s * 0.6]);
  k.swing(pack, "z", 0.1, 2);
  k.bob(g, 0.012, 2.2);
  return { body, head: g, top: 1.5 };
};
// ---- 万尾獅子：白いライオン。黄色い眉と耳の内側・オレンジの鼻と目・先が氷の青の 乳青色のたてがみ・同じ色の たくさんの
//      しっぽの炎と胸の毛・黄色いベスト・こげオレンジの帯・濃い青緑のズボンと手首の輪・指の出る濃い黄色のサンダル・
//      えび茶のさやの長い刀を左の腰に ----
HI_MODELS.万尾獅子 = (k, o, H) => {
  const fur = o.skin ?? 0xf4f2ee, mane = 0xb8d8f0, ice = 0x7ac8f0, vest = 0xf0c840, sash = 0xd0602a, pants = 0x1f5a5a, yel = 0xf2c830;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.15, y: 0.95, len: 0.95, r: 0.11, skin: fur, pants, baggy: 1.4, cuffR: 0.95, foot: "zori", footColor: 0xc8a030, strap: 0xc8a030 });
  const torso = k.group(body, [0, 0.9, 0]);
  const tp = [[0, 0], [0.24, 0.02], [0.25, 0.2], [0.26, 0.42], [0.3, 0.6], [0.24, 0.7], [0.1, 0.75], [0, 0.76]];
  H.O(torso, H.lathe("manTorso", tp, 36, 1.1, 0.82), fur);
  // 胸の毛（たてがみと同じ色）と黄色いベスト（前が開く）
  H.P(torso, hiHair("manChest", Array.from({ length: 26 }, (_, i) => ({ base: [((i % 6) / 5 - 0.5) * 0.18, 0.62 - Math.floor(i / 6) * 0.07, 0.2], dir: [((i % 6) / 5 - 0.5) * 0.4, -1, 0.35], len: 0.12, r: 0.03, droop: 0 }))), mane);
  H.two(torso, hiGeo("L:manVest", m => m.latheArc(tp.slice(1, 7).map(([r, y]) => [r + 0.02, y]), Math.PI * 0.5 + 0.4, Math.PI * 2.5 - 0.4, 30, null, 1.1, 0.82)), vest);
  H.O(torso, H.lathe("manSash", [[0.26, 0.04], [0.27, 0.12], [0.26, 0.2]], 36, 1.1, 0.82), sash, 0, 1, 0, void 0, 0.006);
  H.O(torso, H.ball, sash, [-0.12, 0.1, 0.23], [0.06, 0.05, 0.03]);
  // 左の腰の刀（えび茶のさや）
  const saya = k.group(torso, [-0.28, 0.12, 0.08], [0.2, 0.3, -1.25]);
  H.O(saya, H.lathe("manSaya", [[0, -0.05], [0.028, -0.05], [0.03, 1.0], [0, 1.02]], 12, 1, 0.6), 0x6a1a24);
  H.P(saya, H.ring, 0xc8a040, [0, -0.06, 0], [0.05, 0.2, 0.04]);
  H.P(saya, H.lathe("manTsuka", [[0, -0.3], [0.024, -0.3], [0.026, -0.06], [0, -0.06]], 12), 0x2a2230);
  hiArm(H, body, -1, { x: 0.3, y: 1.56, len: 0.66, r: 0.08, skin: fur, hand: "mitt", band: pants, tilt: 0.22 });
  hiArm(H, body, 1, { x: 0.3, y: 1.56, len: 0.66, r: 0.08, skin: fur, hand: "mitt", band: pants, tilt: 0.22 });
  // 頭：白い顔・大きなたてがみ（先は氷の青）・黄色い眉と耳の内側・オレンジの目と鼻
  const head = k.group(body, [0, 1.88, 0.03]);
  const maneStr = Array.from({ length: 80 }, (_, i) => {
    const a = i / 80 * Math.PI * 2 * 3 + (i % 3) * 0.3, ring = i % 3;
    const b = [Math.cos(a) * 0.2, Math.sin(a) * 0.22 + 0.02, -0.04 - ring * 0.04];
    return { base: b, dir: [Math.cos(a), Math.sin(a) - 0.2, -0.5 - ring * 0.2], len: 0.26 + ring * 0.05 + (i % 5) * 0.02, r: 0.05, droop: 0.3 };
  });
  H.P(head, hiHair("manMane", maneStr, 8), mane);
  H.P(head, hiHair("manManeTip", maneStr.map(s => { const d = kNorm(s.dir), L = s.len; return { base: [s.base[0] + d[0] * L * 0.7, s.base[1] + d[1] * L * 0.7 - L * 0.49 * 0.3, s.base[2] + d[2] * L * 0.7], dir: s.dir, len: L * 0.35, r: 0.03, droop: 0.3 }; }), 8), ice);
  H.O(head, H.ball, fur, [0, 0, 0], [0.22, 0.22, 0.21]);
  H.P(head, H.ball, fur, [0, -0.08, 0.14], [0.13, 0.1, 0.1]);
  H.P(head, H.ball, 0xe8782a, [0, -0.02, 0.23], [0.045, 0.035, 0.03]);
  for (const s of [-1, 1]) {
    const e = k.group(head, [s * 0.16, 0.17, -0.02], [0, 0, -s * 0.3]);
    H.O(e, H.ball, fur, [0, 0, 0], [0.07, 0.07, 0.035]);
    H.P(e, H.ball, yel, [0, 0, 0.02], [0.045, 0.045, 0.02]);
    H.P(head, H.tube("manBrow", t => [t * 0.08, t * 0.03, 0], 0.016, 10, 6), yel, [s * 0.04, 0.12, 0.2], [s, 1, 1], [0, 0, -s * 0.3]);
  }
  hiEyes(H, head, { x: 0.075, y: 0.05, z: 0.18, r: 0.04, white: 0xffffff, iris: 0xe8782a, irisR: 0.6, lid: fur, lidTilt: 0.3, lidY: 0.75, sy: 0.8 });
  H.P(head, H.tube("manMouth", t => [(t - 0.5) * 0.08, -Math.abs(t - 0.5) * 0.04 + 0.02, 0], 0.007, 12, 5), 0x3a2a2a, [0, -0.12, 0.22]);
  // たくさんのしっぽの炎（乳青色）
  const tails = k.group(body, [0, 1.0, -0.2]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8 - 0.5) * 2.2, g = k.group(tails, [0, 0, 0], [0.5 + Math.abs(a) * 0.1, a * 0.5, a * 0.6]);
    H.O(g, H.tube("manTail", t => [0, t * 0.45, -t * 0.2 - t * t * 0.1], t => 0.035 * (1 - t * 0.3), 14, 8), fur);
    hiFlame(H, g, [0, 0.5, -0.33], 0.07, mane);
    k.swing(g, "x", 0.12, 2 + i * 0.1, i);
  }
  k.bob(head, 0.01, 1.8);
  return { body, head, top: 2.3 };
};

// ---- むりだ城：白い壁・石垣におおわれた広がった下の部分・金の飾り 2 つの紺の屋根・灰色のげた・小さな目・
//      ふしぎな形の口（オレンジのふち）・長い腕 ----
HI_MODELS.むりだ城 = (k, o, H) => {
  const wall = o.skin ?? 0xf4f2ea, roof = 0x1e2c5a, stone = 0x9a968c, gold = 0xe0b23a, arm = 0xf0d890;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.28, y: 0.3, len: 0.3, r: 0.1, skin: arm, foot: "geta", footColor: 0x8a8a90, strap: 0x2a2a30 });
  // 石垣（下へ広がる台）と石
  const base = k.group(body, [0, 0.28, 0]);
  H.O(base, H.lathe("ishigaki", [[0.001, 0], [0.82, 0], [0.8, 0.05], [0.66, 0.5], [0.001, 0.52]], 4, 1, 0.75), stone, [0, 0, 0], 1, [0, Math.PI / 4, 0], { flat: 1 }, 0.01);
  H.P(base, hiGeo("B:stones", m => {
    for (let row = 0; row < 5; row++) for (let i = 0; i < 12; i++) {
      const y = 0.05 + row * 0.1, w = 0.8 - y * 0.29, t = (i + (row % 2) * 0.5) / 12, side = Math.floor(t * 4), u = (t * 4) % 1;
      const cx = [w * (u * 2 - 1), w, w * (1 - u * 2), -w][side], cz = [w, w * (1 - u * 2), -w, w * (u * 2 - 1)][side];
      const X = cx * 0.7071 - cz * 0.7071, Z = (cx * 0.7071 + cz * 0.7071) * 0.75;
      const nx = [0, 1, 0, -1][side], nz = [1, 0, -1, 0][side];
      const NX = nx * 0.7071 - nz * 0.7071, NZ = nx * 0.7071 + nz * 0.7071;
      m.ball(4, 6, kXf([X * 0.68 + NX * 0.0, y, Z * 0.68 + NZ * 0.0], [0, -Math.atan2(NZ, NX) + Math.PI / 2, 0], [0.09 + ((i * 7 + row) % 3) * 0.015, 0.042, 0.03]));
    }
  }), shade(stone, -0.15), [0, 0, 0], [1, 1, 1], [0, 0, 0], { flat: 1 });
  // 白い壁（本体）
  const w = k.group(body, [0, 0.8, 0]);
  H.O(w, H.lathe("muriWall", [[0.001, 0], [0.6, 0], [0.58, 0.9], [0.001, 0.9]], 4, 1, 0.55), wall, [0, 0, 0], 1, [0, Math.PI / 4, 0], { flat: 1 }, 0.01);
  // 屋根：紺の瓦の入母屋ふう（二枚の斜面）と棟・金のしゃちほこ 2 つ
  const r = k.group(w, [0, 0.9, 0]);
  for (const s of [-1, 1]) {
    const pl = k.group(r, [0, 0.12, s * 0.22], [s * 0.55, 0, 0]);
    H.O(pl, H.lathe("roofPlane", [[0.001, -0.02], [1, -0.02], [1, 0.02], [0.001, 0.02]], 4, 1, 0.33), roof, [0, 0, 0], [0.72, 1, 1], [0, Math.PI / 4, 0], { flat: 1 }, 0.02);
    H.P(pl, hiGeo("T:kawara", m => { for (let i = 0; i < 12; i++) m.tube(t => [-0.66 + i * 0.12, 0.028, -0.3 + t * 0.6], 0.018, 6, 6); }), shade(roof, 0.18));
  }
  H.O(r, H.lathe("mune", [[0, -0.7], [0.05, -0.7], [0.05, 0.7], [0, 0.7]], 12), shade(roof, -0.2), [0, 0.3, 0], 1, [0, 0, Math.PI / 2], void 0, 0.01);
  for (const s of [-1, 1]) {
    const sh = k.group(r, [s * 0.62, 0.36, 0], [0, s > 0 ? 0 : Math.PI, 0]);
    H.O(sh, H.tube("shachi", t => [-t * 0.05, t * 0.22 - t * t * 0.05, 0], t => 0.06 * Math.sin(Math.PI * (0.15 + t * 0.85)) + 0.01, 16, 12), gold, [0, 0, 0], 1, 0, { glow: 0x2a1c00 }, 0.02);
    H.P(sh, H.lathe("shachiTail", [[0, 0], [0.06, 0.02], [0.02, 0.1], [0, 0.12]], 10, 1, 0.3), gold, [-0.08, 0.2, 0], 1, [0, 0, 0.6], { glow: 0x2a1c00 });
  }
  // 顔：小さな目（青い隈）・オレンジのふちの口
  const head = k.group(w, [0, 0.55, 0.33]);
  for (const s of [-1, 1]) {
    H.P(head, H.ball, 0x14101c, [s * 0.16, 0.05, 0], [0.035, 0.045, 0.02]);
    H.P(head, H.tube("muriBag", t => [(t - 0.5) * 0.1, -Math.sin(t * Math.PI) * 0.02, 0], 0.008, 10, 5), 0x3a5ad8, [s * 0.16, -0.01, 0.005]);
  }
  H.P(head, H.tube("muriMouth", t => { const a = t * Math.PI * 2; return [Math.cos(a) * 0.11, Math.sin(a) * 0.05 + Math.sin(a * 3) * 0.012, 0]; }, 0.015, 40, 6), 0xe8782a, [0, -0.2, 0.0]);
  H.P(head, H.ball, 0x3a0a14, [0, -0.2, -0.005], [0.1, 0.045, 0.01]);
  // 長い腕（壁の横から）
  for (const s of [-1, 1]) hiArm(H, w, s, { x: 0.44, y: 0.6, len: 0.85, r: 0.07, skin: arm, hand: "mitt", tilt: 0.25, shoulder: false });
  return { body, head, top: 2.3 };
};

// ---- あせっか鬼：大きな体・頭のてっぺんに小さな角 2 本・厚いくちびる・いつも汗がにじみ出る・黒い虎縞の赤いズボン・
//      はだし・右手に白い汗ふきタオル ----
HI_MODELS.あせっか鬼 = (k, o, H) => {
  const skin = o.skin ?? 0xe8845a, trouser = 0xd8342a, sweat = 0x9ad8ff;
  const body = k.group(null);
  const legs = [];
  for (const s of [-1, 1]) legs.push(hiLeg(H, body, s, { x: 0.26, y: 0.72, len: 0.72, r: 0.17, skin, pants: trouser, baggy: 1.25, foot: "bare" }));
  // 虎縞（ズボンにはりつく黒い筋）
  for (const l of legs) H.P(l.leg, hiGeo("T:asekStripe", m => { for (let i = 0; i < 6; i++) { const a0 = i * 1.05; m.tube(t => { const a = a0 + t * 0.9, y = -0.05 - i * 0.05 - t * 0.12; return [Math.cos(a) * 0.222, y, Math.sin(a) * 0.222]; }, t => 0.02 * Math.sin(Math.PI * t) + 0.003, 12, 5); } }), 0x14121a);
  // 大きな丸い体
  const torso = k.group(body, [0, 0.7, 0]);
  const tp = [[0, 0], [0.45, 0.02], [0.6, 0.25], [0.62, 0.5], [0.55, 0.78], [0.38, 0.95], [0.15, 1.02], [0, 1.03]];
  H.O(torso, H.lathe("asekTorso", tp, 44, 1.05, 0.95), skin);
  H.O(torso, H.lathe("asekWaist", [[0.47, -0.02], [0.5, 0.06], [0.46, 0.12]], 44, 1.05, 0.95), trouser, 0, 1, 0, void 0, 0.006);
  H.P(torso, H.ball, shade(skin, 0.1), [0, 0.45, 0.36], [0.4, 0.38, 0.25]);
  H.P(torso, H.ballS, shade(skin, -0.3), [0, 0.35, 0.6], [0.025, 0.035, 0.02]); // へそ
  // 汗のしずく（体・頭にちらす。半透明）
  const drops = (n, fn) => hiGeo("B:sweat" + n, m => { for (let i = 0; i < n; i++) m.lathe([[0, 0], [0.45, 0.25], [0.5, 0.55], [0.3, 0.85], [0, 1.1]], 10, kXf(fn(i), [0.15, 0, 0], [0.028, 0.045, 0.028])); });
  H.P(torso, drops(24, i => { const h = hash32("asek" + i), a = Math.PI * (0.05 + (h % 1000) / 1000 * 0.9), y = 0.15 + ((h >> 10) % 1000) / 1000 * 0.75, r = kRadAt(tp, y); return [Math.cos(a) * r * 1.06, y, Math.sin(a) * r * 0.96]; }), sweat, 0, 1, 0, { alpha: 0.75, glow: 0x103040 });
  hiArm(H, body, -1, { x: 0.62, y: 1.52, len: 0.72, r: 0.13, skin, hand: "fist", tilt: 0.45 });
  const ra = hiArm(H, body, 1, { x: 0.62, y: 1.52, len: 0.72, r: 0.13, skin, hand: "fist", tilt: 0.45 });
  // 右手の白いタオル（たれ下がる）
  const towel = hiGeo("G:towel", m => m.grid(18, 9, (i, j) => { const u = i / 17, v = j / 8 - 0.5; return [v * 0.2 + Math.sin(u * 3) * 0.03, -u * 0.5, 0.06 + Math.sin(v * 9 + u * 4) * 0.02 + u * u * 0.06]; }, null, false));
  H.two(ra.hand, towel, 0xfafafa, [0, -0.04, 0.02]);
  H.P(ra.hand, hiGeo("T:towelLines", m => { for (const u of [0.85, 0.9]) m.tube(t => [(t - 0.5) * 0.2 + Math.sin(u * 3) * 0.03, -u * 0.5, 0.065 + Math.sin((t - 0.5) * 9 + u * 4) * 0.02 + u * u * 0.06], 0.006, 12, 4); }), 0x5a9ad8, [0, -0.04, 0.02]);
  // 頭：小さな角 2 本・厚いくちびる・汗
  const head = hiHead(H, body, [0, 1.95, 0.08], { r: 0.26, skin, ear: "round", tall: 1, eyes: { white: 0xffffff, iris: 0x14101c, irisR: 0.55, r: 0.05, lid: skin, lidY: 0.6, lidTilt: -0.2 }, brow: 0x3a1a14, browTilt: -0.3, mouth: "line", lips: 0xf28a8a, mouthY: 0.45 });
  for (const s of [-1, 1]) H.O(head, H.tube("asekHorn", t => [s * t * 0.02, t * 0.1, 0], t => 0.035 * (1 - t) + 0.004, 10, 10), 0xf6ecd0, [s * 0.08, 0.26, 0], 1, 0, void 0, 0.01);
  H.P(head, drops(10, i => { const a = Math.PI * (0.15 + i * 0.07); return [Math.cos(a) * 0.26, 0.1 - (i % 3) * 0.08, Math.sin(a) * 0.25]; }), sweat, 0, 1, 0, { alpha: 0.75, glow: 0x103040 });
  k.bob(head, 0.012, 2.6);
  return { body, head, top: 2.3 };
};

// ---- ブリー隊長：人に近い鬼。牙・角 1 本・腰巻き・ととのった彫りの深い顔・ブロンズ色の肌・とても たくましい・
//      黄色い指ぬきグローブ・体にぴったりの軍隊の緑のタンクトップ・腰巻きの下に斑点・はだし ----
HI_MODELS.ブリー隊長 = (k, o, H) => {
  const skin = o.skin ?? 0xc88a58, green = 0x4a5a2a, yellow = 0xf2c830, loin = 0xe8c050;
  const body = k.group(null);
  for (const s of [-1, 1]) hiLeg(H, body, s, { x: 0.18, y: 1.0, len: 1.0, r: 0.14, skin, foot: "bare" });
  // 腰巻き（斑点）
  const waist = k.group(body, [0, 1.06, 0]);
  const skirt = [[0.3, 0.1], [0.33, 0.0], [0.36, -0.12], [0.38, -0.2]];
  H.two(waist, H.sleeve("burlyLoin", skirt, 40), loin, [0, 0, 0], [1.1, 1, 0.85]);
  H.P(waist, hiGeo("B:burlySpots", m => { for (let i = 0; i < 26; i++) { const a = i * 2.4, y = 0.06 - ((i * 0.618) % 1) * 0.24, r = kRadAt(skirt, y) + 0.006; m.ball(5, 7, kXf([Math.cos(a) * r * 1.1, y, Math.sin(a) * r * 0.85], [0, -a, 0], [0.012, 0.03, 0.025])); } }), 0x2a1c14);
  H.P(waist, H.ring, 0x2a1c14, [0, 0.1, 0], [0.34, 0.25, 0.27]);
  // 胴：逆三角の上半身にタンクトップ
  const torso = k.group(body, [0, 1.12, 0]);
  const tp = [[0, 0], [0.28, 0.01], [0.29, 0.15], [0.32, 0.32], [0.42, 0.48], [0.46, 0.58], [0.4, 0.66], [0.2, 0.72], [0, 0.73]];
  H.O(torso, H.lathe("burlyTorso", tp, 40, 1.15, 0.72), skin);
  const top = tp.slice(1, 7).map(([r, y]) => [r + 0.012, y]);
  H.O(torso, H.lathe("burlyTank", top, 40, 1.15, 0.72), green, 0, 1, 0, void 0, 0.006);
  for (const s of [-1, 1]) {
    H.P(torso, H.ball, shade(green, 0.08), [s * 0.17, 0.5, 0.26], [0.17, 0.11, 0.08], [0, s * 0.3, 0]); // 胸（服の上から）
    H.P(torso, H.tube("strap", t => [s * 0.2, 0.6 + t * 0.1, 0.18 - t * 0.3], 0.03, 8, 6), green); // 肩ひも
    H.P(torso, H.ball, skin, [s * 0.3, 0.64, 0], [0.15, 0.07, 0.14], [0, 0, s * -0.4]); // 僧帽筋
  }
  for (const s of [-1, 1]) {
    const a = hiArm(H, body, s, { x: 0.5, y: 1.76, len: 0.9, r: 0.12, skin, hand: "fist", handColor: yellow, tilt: 0.3 });
    H.P(a.sh, H.ball, shade(skin, 0.08), [0, -0.2, 0.08], [0.1, 0.14, 0.09]); // 力こぶ
    H.P(a.el, H.lathe("glove", [[0.12, 0.02], [0.12, -0.1]], 24), yellow, [0, -0.35, 0]); // グローブの手首
  }
  // 頭：彫りの深い顔・角 1 本・小さな牙・黒い髪
  const head = hiHead(H, body, [0, 2.06, 0.03], { r: 0.2, skin, jawW: 0.88, ear: "pointed", eyes: { white: 0xffffff, iris: 0x1c1410, irisR: 0.55, r: 0.035, lid: skin, lidY: 0.55, lidTilt: 0.25 }, brow: 0x1c1410, browTilt: 0.35, mouth: "fang" });
  H.P(head, H.ball, skin, [0, -0.13, 0.12], [0.14, 0.07, 0.1]); // 角ばったあご
  H.O(head, H.ball, 0x1c1410, [0, 0.07, -0.02], [0.205, 0.17, 0.205], 0, void 0, 0.02);
  H.P(head, hiHair("burly", Array.from({ length: 30 }, (_, i) => { const a = Math.PI * (0.1 + ((i * 0.618) % 1) * 0.8); return { base: [Math.cos(a) * 0.14, 0.18, Math.sin(a) * 0.1], dir: [Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3 - 0.7], len: 0.14, r: 0.035, droop: 0.4 }; })), 0x1c1410);
  H.O(head, H.tube("burlyHorn", t => [0, t * 0.14, t * t * 0.03], t => 0.035 * (1 - t) + 0.004, 12, 10), 0xf4ecd8, [0, 0.19, 0.12], 1, [-0.2, 0, 0], void 0, 0.01);
  k.bob(head, 0.01, 2);
  return { body, head, top: 2.4 };
};

hiRegister();
