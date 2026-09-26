// ============================================================================
// ふだんの行動のモーション（奥義は ult_motion.js）。本家の対戦の見せ方に寄せる：
//   こうげき … 相手の前まで跳んでいき、わざの名前どおりの動き（パンチ・かみつく・しっぽ・斬る…）で当てて戻る
//   ようじゅつ … その場で術の陣（属性の字）を出して構え、相手の上に属性の術が落ちる（fx_spells.js）
//   とりつく … 半透明になって相手の上へふわっと飛び、まわりを回ってから戻る
//   ガード … 腕を組んで身をかがめる（ガード中は六角の結界。statusFx）
//   サボり … 寝る・あくび・よそ見・おどる（その妖怪ごとに決まる）
//   被弾 … のけぞる／よける … 横に跳んで残像／気絶 … 吹っとんで倒れ、魂が抜ける
//   登場 … ホイールで前に出たとき、跳んで着地／勝敗 … 勝った側は跳ねてよろこび、負けた側はうなだれる
// ダメージの数字は行動から約 0.48 秒後に出るので、当たる瞬間をそこに合わせる。
// 姿勢は { pos, y, rx, rz, face, spin, sx, sy, op, armL, armR, armZ, head } で返し、updateFigure で当てる。
// ============================================================================

// わざの名前 → こうげきの動き（本家のこうげき 47 種）
var ATK_MOTION = [
  [/ロケットパンチ/, "rocket"], [/しゅりけん|スプレー|しゃげき|大砲|弓矢/, "shoot"],
  [/つばめがえし|閃光ぎり|きりつける/, "blade"], [/するどいつめ/, "claw"],
  [/くらいつく|かみちぎる|かみつく/, "bite"], [/舌でなめる/, "lick"], [/しっぽうち/, "tail"],
  [/あびせげり|地獄げり|けり/, "kick"], [/ずつき|ヘッドバット/, "headbutt"], [/タックル/, "tackle"],
  [/のしかかる|おしつぶす/, "bodyslam"], [/ドクロ割り|脳天かちわり|骨くだき|こなごなつぶし|地球わり/, "overhead"],
  [/フルスイング/, "swing"], [/めったうち|うちまくり|みだれづき|つっぱり|ワンツーパンチ/, "combo"],
  [/きゅうしょづき|疾風づき|風穴あけ/, "thrust"], [/はたく|はりたおす|たたく|ぶったたく/, "slap"],
  [/パンチ|正拳突き|あてみ|ぶんなぐる|こづく/, "punch"],
];
var ATK_MOTION_JA = { rocket: "ロケットパンチ", shoot: "飛び道具", blade: "斬る", claw: "ひっかく", bite: "かみつく", lick: "なめる", tail: "しっぽ",
  kick: "けり", headbutt: "ずつき", tackle: "体当たり", bodyslam: "のしかかり", overhead: "ふりおろし", swing: "ふりまわし", combo: "連打",
  thrust: "突き", slap: "はたく", punch: "パンチ" };
function attackMotionOf(def) {
  const n = def?.attackName ?? "";
  for (const [re, m] of ATK_MOTION) if (re.test(n)) return m;
  return "punch";
}
// サボりかた（本家の「なまけている」：寝る・あくび・よそ見・おどる）
var LOAF_STYLES = ["sleep", "yawn", "away", "dance"];
function loafStyleOf(def) { return LOAF_STYLES[hash32("loaf:" + (def?.name ?? "")) % LOAF_STYLES.length]; }
// 術の名前 → 強さ（小・中・大）。本家の術は 3 段階（火花→火炎→れんごく など）
function spellTier(def) {
  const n = def?.skillName ?? "";
  if (/れんごく|いん石|吹雪|雷神|大滝|嵐|極楽|死神/.test(n)) return 2;
  if (/火炎|落石|氷結|いかずち|水流|竜巻|いやし|吸収/.test(n)) return 1;
  return 0;
}

var MV_HIT_AT = 0.47; // 行動の出来事から、ダメージの数字が出るまで（秒）

Object.assign(e2.prototype, {
  // ---- 始める ----
  startMove(uid, style, o = {}) {
    const f = this.figs.get(uid);
    if (!f) return null;
    f.baseYaw ??= f.model.rotation.y;
    const tf = o.target != null ? this.figs.get(o.target) : null;
    const home = f.home.clone();
    const T = tf ? tf.home.clone() : home.clone().add(new D(0, 0, f.ally ? -4.6 : 4.6));
    const dir = T.clone().sub(home).setY(0);
    dir.lengthSq() < 1e-6 ? dir.set(0, 0, f.ally ? -1 : 1) : dir.normalize();
    const DUR = { enter: 0.7, ko: 1.1, hurt: 0.4, dodge: 0.55, guard: 0.7, possess: 1.25, cast: 1.05, loaf: 1.6, cheer: 1.2, slump: 1.4, shoot: 0.9, rocket: 0.95, blade: 1.05, bodyslam: 1.05, overhead: 1.05, combo: 1.05, tackle: 0.95 };
    f.anim = { kind: "mv", style, t: 0, dur: (DUR[style] ?? 0.98) * (o.slow ?? 1), home, T, dir, fired: new Set(), trail: 0, color: o.color ?? 0xffffff, tf, o,
      side: hash32("side:" + f.uid) % 2 ? 1 : -1 };
    return f.anim;
  },

  // ---- 毎フレームの姿勢 ----
  mvPose(f, a, k, dt) {
    const o = { pos: a.home.clone(), y: 0, rx: 0, rz: 0, face: null, spin: 0, sx: 1, sy: 1, op: 1, armL: 0, armR: 0, armZ: 0, head: 0 };
    const t = a.t, H = a.home, T = a.T, d = a.dir, c = a.color;
    const once = (key, at, fn) => { if (t >= at && !a.fired.has(key)) { a.fired.add(key); fn(); } };
    const facing = to => Math.atan2(to.x - o.pos.x, to.z - o.pos.z);
    const front = T.clone().sub(d.clone().multiplyScalar(1.15)); // 相手の目の前
    const hit = MV_HIT_AT;
    // 相手の前まで跳んでいき（0 → t0）、当てて、戻る（t1 → 終わり）
    const approach = (t0, t1, hop = 0.55, to = front) => {
      const tEnd = a.dur;
      if (t < t0) { const u = easeOutK(t / t0); o.pos.lerpVectors(H, to, u); o.y = Math.sin(u * Math.PI) * hop; }
      else if (t < t1) o.pos.copy(to);
      else { const u = segK(t, t1, tEnd * 0.96); o.pos.lerpVectors(to, H, easeOutK(u)); o.y = Math.sin(u * Math.PI) * 0.7; }
      o.face = t < t1 ? facing(T) : null;
    };
    const wind = (from, to, at) => clamp01((t - from) / (at - from)); // 構え 0→1
    const impactK = (w = 0.12) => Math.max(0, 1 - Math.abs(t - hit) / w); // 当たる前後だけ 1 に近い
    const hitFx = (big = 1) => this.moveImpact(T, c, big, a);
    switch (a.style) {
      // ---------- こうげき ----------
      case "punch": {
        approach(0.3, 0.62);
        const w = wind(0.25, 0.4, hit);
        o.armR = t < 0.4 ? 1.1 * wind(0.2, 0.4, 0.4) : t < hit ? 1.1 - 2.9 * segK(t, 0.4, hit) : -1.8 * (1 - segK(t, hit + 0.08, 0.62));
        o.rx = 0.25 * impactK(0.1) - 0.1 * w * (t < 0.4 ? 1 : 0);
        once("hit", hit, () => { hitFx(1); this.punchRing(T, c); });
        break;
      }
      case "combo": {
        approach(0.3, 0.7);
        const n = 4, s0 = 0.3, s1 = 0.62;
        if (t >= s0 && t < s1) {
          const u = (t - s0) / (s1 - s0) * n, i = Math.floor(u), fr = u - i;
          const v = -1.7 * Math.sin(fr * Math.PI);
          i % 2 ? (o.armL = v) : (o.armR = v);
          o.pos.add(d.clone().multiplyScalar(0.18 * Math.sin(fr * Math.PI)));
          o.rz = (i % 2 ? -1 : 1) * 0.12 * Math.sin(fr * Math.PI);
        }
        for (let i = 0; i < n; i++) once("c" + i, s0 + (i + 0.5) / n * (s1 - s0), () => { i === n - 1 ? hitFx(1) : this.smallHit(T, c, i); });
        break;
      }
      case "slap": {
        approach(0.3, 0.62);
        o.armR = -1.2 * Math.min(1, segK(t, 0.25, 0.4));
        o.armZ = t < hit ? 1.3 * segK(t, 0.25, 0.4) : 1.3 - 2.8 * Math.min(1, segK(t, hit - 0.02, hit + 0.08));
        o.rz = -0.25 * impactK(0.1) * a.side, o.spin = 0.35 * a.side * impactK(0.15);
        once("hit", hit, () => { hitFx(0.9); this.slashAt(T, 0xffffff, 1.2, Math.PI / 2); });
        break;
      }
      case "claw": {
        approach(0.28, 0.62);
        o.armR = -2.4 * wind(0.28, 0.4, 0.4) + 3.2 * segK(t, 0.4, hit);
        o.armL = o.armR * 0.8;
        o.rx = 0.35 * impactK(0.12);
        once("hit", hit, () => { hitFx(1); this.clawMarks(T, c); });
        break;
      }
      case "bite": case "lick": {
        approach(0.3, 0.62);
        const lung = impactK(0.14);
        o.pos.add(d.clone().multiplyScalar(0.35 * lung));
        o.rx = 0.55 * lung, o.head = 0.6 * lung, o.sy = 1 + (a.style === "lick" ? 0.25 : 0.08) * lung;
        once("hit", hit, () => { hitFx(a.style === "lick" ? 0.7 : 1); a.style === "lick" ? this.sparkle(T.clone().setY(1), 0xff8ab0, 12, 1.8, 0.25, 0.8) : this.biteJaws(T); });
        break;
      }
      case "tail": {
        approach(0.3, 0.64);
        o.spin = easeInK(segK(t, 0.3, hit + 0.06)) * Math.PI * 2 * a.side;
        o.y += 0.2 * Math.sin(segK(t, 0.3, 0.6) * Math.PI);
        once("hit", hit, () => { hitFx(1); this.slashAt(T, c, 1.8, 0.2); });
        break;
      }
      case "kick": {
        approach(0.3, 0.64, 0.35);
        const u = segK(t, 0.33, hit + 0.05);
        o.y += 0.9 * Math.sin(u * Math.PI);
        o.rx = -u * Math.PI * 2; // 宙返りしてけり下ろす
        once("hit", hit, () => { hitFx(1.1); this.shockwave(T, 0xffffff, 1.4, 0.35); });
        break;
      }
      case "headbutt": {
        approach(0.28, 0.62);
        o.rx = -0.4 * segK(t, 0.28, 0.4) * (t < 0.4 ? 1 : 0) + 0.9 * impactK(0.1);
        o.pos.add(d.clone().multiplyScalar(0.3 * impactK(0.1)));
        once("hit", hit, () => { hitFx(1.1); this.starBurst(T.clone().setY(1.4)); });
        break;
      }
      case "tackle": {
        // 助走なしで一直線に突っこむ
        const ramp = 0.12;
        if (t < ramp) { o.sy = 1 - 0.2 * Math.sin(t / ramp * Math.PI); o.pos.copy(H); }
        else if (t < hit) { o.pos.lerpVectors(H, T.clone().sub(d.clone().multiplyScalar(0.8)), easeInK(segK(t, ramp, hit))); this.trailAt(a, o, c, dt); }
        else if (t < 0.62) o.pos.copy(T.clone().sub(d.clone().multiplyScalar(0.8 + 0.4 * segK(t, hit, 0.62))));
        else { const u = segK(t, 0.62, a.dur * 0.95); o.pos.lerpVectors(T.clone().sub(d.clone().multiplyScalar(1.2)), H, easeOutK(u)); o.y = Math.sin(u * Math.PI) * 0.6; }
        o.rx = t < hit ? 0.35 : 0, o.rz = t < hit ? 0.2 * a.side : 0, o.face = t < 0.62 ? facing(T) : null;
        once("hit", hit, () => { hitFx(1.3); this.shockwave(T, c, 2.2, 0.45); });
        break;
      }
      case "bodyslam": {
        // 高く跳んで相手の上に落ちる
        const up = segK(t, 0.05, hit);
        if (t < hit) { o.pos.lerpVectors(H, T.clone().sub(d.clone().multiplyScalar(0.3)), easeOutK(up)); o.y = 2.2 * Math.sin(up * Math.PI * 0.5 + (up > 0.6 ? 0 : 0)) * (1 - easeInK(segK(t, 0.35, hit))); }
        else if (t < 0.7) { o.pos.copy(T.clone().sub(d.clone().multiplyScalar(0.3))); const s = Math.sin(segK(t, hit, 0.62) * Math.PI); o.sy = 1 - 0.35 * s, o.sx = 1 + 0.25 * s; }
        else { const u = segK(t, 0.7, a.dur * 0.95); o.pos.lerpVectors(T.clone().sub(d.clone().multiplyScalar(0.3)), H, easeOutK(u)); o.y = Math.sin(u * Math.PI) * 0.9; }
        o.face = t < 0.7 ? facing(T) : null;
        once("hit", hit, () => { hitFx(1.3); this.groundCrack(T, c); });
        break;
      }
      case "overhead": {
        approach(0.28, 0.66, 0.9);
        const raise = segK(t, 0.22, 0.38);
        o.armR = t < 0.38 ? -2.9 * raise : t < hit ? -2.9 + 3.6 * easeInK(segK(t, 0.38, hit)) : 0.7 * (1 - segK(t, hit + 0.05, 0.66));
        o.armL = o.armR * 0.7;
        o.rx = t < hit ? -0.25 * raise : 0.45 * impactK(0.12);
        once("hit", hit, () => { hitFx(1.3); this.groundCrack(T, c); });
        break;
      }
      case "swing": {
        approach(0.3, 0.66);
        o.armR = -1.5 * segK(t, 0.25, 0.35), o.armZ = -1.2 * segK(t, 0.25, 0.35);
        o.spin = easeInK(segK(t, 0.33, hit + 0.08)) * Math.PI * 2 * a.side;
        once("hit", hit, () => { hitFx(1.1); this.slashAt(T, c, 2.2, 0); this.slashAt(T, 0xffffff, 1.6, 0.1); });
        break;
      }
      case "thrust": {
        approach(0.26, 0.6, 0.3);
        o.armR = t < 0.36 ? 0.8 * segK(t, 0.26, 0.36) : -1.6 * (1 - segK(t, hit + 0.06, 0.6));
        o.pos.add(d.clone().multiplyScalar(0.45 * impactK(0.1)));
        o.rx = 0.3 * impactK(0.1);
        if (t > 0.36 && t < hit + 0.04) this.trailAt(a, o, c, dt);
        once("hit", hit, () => { hitFx(1.1); this.thrustLine(T, d, c); });
        break;
      }
      case "blade": {
        // 相手をすり抜けて斬り、ふり向いてもう一度（つばめがえし）
        const pass = T.clone().add(d.clone().multiplyScalar(1.4));
        if (t < 0.18) { o.sy = 1 - 0.15 * Math.sin(t / 0.18 * Math.PI); o.armR = -2.2 * (t / 0.18); }
        else if (t < hit) { o.pos.lerpVectors(H, pass, easeInK(segK(t, 0.18, hit))); o.op = 0.55; o.armR = 1.2; this.trailAt(a, o, c, dt); }
        else if (t < 0.7) { o.pos.copy(pass); o.face = facing(H); o.armR = 1.2 - 2.6 * segK(t, 0.6, 0.66); }
        else { const u = segK(t, 0.7, a.dur * 0.95); o.pos.lerpVectors(pass, H, easeOutK(u)); o.y = Math.sin(u * Math.PI) * 0.8; }
        if (t < 0.7 && o.face === null) o.face = facing(T);
        once("hit", hit, () => { hitFx(1); this.slashAt(T, c, 2, 0.6); this.slashAt(T, 0xffffff, 1.5, 0.7); });
        once("hit2", 0.64, () => { this.slashAt(T, c, 1.6, -0.6); this.sparkle(T.clone().setY(1), c, 8, 2.4, 0.22); });
        break;
      }
      case "rocket": {
        o.face = facing(T);
        o.armR = -1.6 * segK(t, 0.05, 0.18);
        o.rx = -0.25 * impactK(0.2);
        once("fire", 0.16, () => this.missile(f, T, c, hit - 0.16, true));
        once("hit", hit, () => hitFx(1.1));
        break;
      }
      case "shoot": {
        o.face = facing(T);
        o.armR = o.armL = -1.4 * segK(t, 0.05, 0.16);
        o.rx = -0.2 * Math.max(0, 1 - Math.abs(t - 0.2) / 0.08);
        o.pos.sub(d.clone().multiplyScalar(0.2 * Math.max(0, 1 - Math.abs(t - 0.2) / 0.1)));
        once("fire", 0.2, () => this.missile(f, T, c, hit - 0.2, false));
        once("hit", hit, () => hitFx(0.9));
        break;
      }
      // ---------- ようじゅつ ----------
      case "cast": {
        o.face = facing(T);
        const up = segK(t, 0, 0.28), down = segK(t, 0.7, a.dur);
        o.y = 0.35 * easeOutK(up) * (1 - down);
        o.armL = o.armR = -2.6 * easeOutK(up) * (1 - down);
        o.armZ = 0.5 * up * (1 - down);
        o.spin = a.o.heal ? segK(t, 0, 0.7) * Math.PI * 2 : 0;
        o.sy = 1 + 0.12 * Math.sin(segK(t, 0.3, 0.55) * Math.PI);
        once("circle", 0, () => this.spellCircle(f, a.o.element, a.o.heal ? 0x7fd46b : c, a.dur * 0.85));
        once("spell", a.o.heal ? 0.3 : hit - 0.25, () => this.spellFx(f, a.o, c));
        break;
      }
      // ---------- とりつく ----------
      case "possess": {
        const above = T.clone().add(new D(0, 0, 0)), r = 0.7;
        if (t < 0.35) { const u = easeOutK(t / 0.35); o.pos.lerpVectors(H, above, u); o.y = 0.3 + 1.4 * Math.sin(u * Math.PI * 0.5); o.op = 1 - 0.5 * u; }
        else if (t < 0.85) { const u = (t - 0.35) / 0.5, ang = u * Math.PI * 2; o.pos.copy(above).add(new D(Math.cos(ang) * r, 0, Math.sin(ang) * r)); o.y = 1.7 + 0.15 * Math.sin(u * 12); o.op = 0.5; o.spin = u * Math.PI * 2; }
        else { const u = easeOutK(segK(t, 0.85, a.dur)); o.pos.lerpVectors(above, H, u); o.y = 1.7 * (1 - u); o.op = 0.5 + 0.5 * u; }
        o.armL = o.armR = -1.8 * Math.sin(segK(t, 0.2, 0.9) * Math.PI);
        o.sx = o.sy = 1 - 0.25 * Math.sin(segK(t, 0.1, 0.95) * Math.PI);
        this.ghostTrail(a, o, a.o.good ? 0xf2d15c : 0x9a5ad0, dt);
        once("merge", 0.5, () => { const p = T.clone().setY(1.6); this.flare(p, a.o.good ? 0xfff2a0 : 0x9a5ad0, 2.2, 0.35); this.sparkle(p, a.o.good ? 0xf2d15c : 0xb07ce0, 10, 1.6, 0.22, 0.4); });
        break;
      }
      // ---------- ガード ----------
      case "guard": {
        const u = Math.min(1, t / 0.15);
        o.armL = o.armR = -1.5 * u, o.armZ = -0.9 * u; // 腕を前で組む
        o.sy = 1 - 0.12 * u, o.sx = 1 + 0.05 * u, o.rx = 0.12 * u;
        once("shield", 0.05, () => this.shieldFlash(f));
        break;
      }
      // ---------- サボり ----------
      case "loaf": {
        const st = a.o.loaf ?? "sleep", u = Math.sin(clamp01(t / 0.25) * Math.PI * 0.5) * (1 - segK(t, a.dur - 0.25, a.dur));
        if (st === "sleep") { o.rz = 0.9 * u * a.side, o.y = -0.1 * u, o.head = 0.5 * u; once("z", 0.1, () => this.floatText(f, "Z", 0x9ad0ff, 3)); }
        else if (st === "yawn") { o.armL = o.armR = -2.8 * u, o.sy = 1 + 0.15 * u, o.rx = -0.25 * u, o.head = -0.4 * u; once("z", 0.2, () => this.floatText(f, "…", 0xd8d0c0, 1)); }
        else if (st === "away") { o.spin = Math.PI * 0.9 * u * a.side, o.head = 0.2 * u; once("z", 0.2, () => this.floatText(f, "～", 0xd8d0c0, 1)); }
        else { o.y = Math.abs(Math.sin(t * 9)) * 0.25 * u, o.rz = Math.sin(t * 9) * 0.25 * u, o.armL = -2.2 * u * (0.5 + 0.5 * Math.sin(t * 9)), o.armR = -2.2 * u * (0.5 - 0.5 * Math.sin(t * 9)); once("z", 0.1, () => this.floatText(f, "♪", 0xf2d15c, 3)); }
        break;
      }
      // ---------- 受け身 ----------
      case "hurt": {
        const u = Math.sin(clamp01(t / a.dur) * Math.PI);
        o.pos.add(d.clone().multiplyScalar(-0.3 * u)); // 相手から離れる向きへ
        o.rx = -0.35 * u, o.sy = 1 - 0.08 * u, o.head = -0.3 * u;
        o.armL = o.armR = 0.6 * u;
        break;
      }
      case "dodge": {
        const lat = new D(-d.z, 0, d.x).multiplyScalar(0.9 * a.side), u = Math.sin(clamp01(t / a.dur) * Math.PI);
        o.pos.add(lat.multiplyScalar(u)), o.y = 0.4 * u, o.rz = -0.4 * u * a.side;
        once("ghost", 0, () => this.afterimage(f));
        once("miss", 0.05, () => this.floatText(f, "MISS", 0xffffff, 1, 0.9));
        break;
      }
      case "ko": {
        const u = segK(t, 0, 0.55), land = segK(t, 0.55, 0.75);
        o.pos.add(d.clone().multiplyScalar(-1.1 * easeOutK(u)));
        o.y = 1.2 * Math.sin(u * Math.PI) * (1 - land);
        o.spin = u * Math.PI * 2 * a.side;
        o.rz = 1.4 * easeOutK(segK(t, 0.35, 0.75)) * (a.o.ally ? -1 : 1);
        o.op = 1 - 0.7 * segK(t, 0.7, 1);
        once("land", 0.55, () => { this.shockwave(o.pos.clone(), 0xd8d0c0, 1.2, 0.4); this.sparkle(o.pos.clone().setY(0.1), 0xd8d0c0, 8, 1.4, 0.3, 0.3); });
        once("soul", 0.7, () => this.soulOut(o.pos.clone()));
        break;
      }
      case "enter": {
        const from = H.clone().add(new D(0, 0, a.o.ally ? 2.2 : -2.2));
        const u = easeOutK(segK(t, 0, 0.55));
        o.pos.lerpVectors(from, H, u), o.y = 1.1 * Math.sin(u * Math.PI);
        o.rx = (1 - u) * Math.PI * 2 * (a.o.ally ? -1 : 1);
        const sq = Math.sin(segK(t, 0.55, 0.75) * Math.PI);
        o.sy = 1 - 0.2 * sq, o.sx = 1 + 0.12 * sq;
        o.armL = o.armR = -2.4 * Math.sin(segK(t, 0.6, 1) * Math.PI);
        once("land", 0.55, () => { this.shockwave(H, a.o.tribe ?? 0xf2d15c, 1.3, 0.45); this.sparkle(H.clone().setY(0.3), 0xfff2a0, 10, 1.8, 0.22, 1); });
        break;
      }
      case "cheer": {
        const u = Math.sin(clamp01(t / a.dur) * Math.PI);
        o.y = 0.7 * u, o.armL = o.armR = -2.9 * u, o.spin = clamp01(t / a.dur) * Math.PI * 2 * a.side;
        once("s", 0.35, () => this.sparkle(H.clone().setY(1.6), 0xf2d15c, 10, 1.6, 0.22, 1));
        break;
      }
      case "slump": {
        const u = Math.min(1, t / 0.4);
        o.rx = 0.55 * u, o.head = 0.5 * u, o.sy = 1 - 0.12 * u, o.armL = o.armR = 0.3 * u;
        break;
      }
    }
    return o;
  },

  // 演出の時間で sec 秒あとに fn（実時間の setTimeout だと、描画が遅い端末で動きとずれる）
  later(sec, fn) {
    const g = new qr();
    this.fxAdd(g, Math.max(0.001, sec), k => { if (k >= 1) fn(); });
  },

  // ---- 共通の小さな演出 ----
  trailAt(a, o, c, dt) {
    a.trail -= dt;
    if (a.trail > 0) return;
    a.trail = 0.04;
    this.flare(o.pos.clone().setY(o.y + 0.8), c, 0.9, 0.25);
  },
  ghostTrail(a, o, c, dt) {
    a.trail -= dt;
    if (a.trail > 0 || this.reduced) return;
    a.trail = 0.05;
    const s = new Rl(new An({ map: this.glow(), color: c, transparent: !0, depthWrite: !1, blending: hi }));
    const p = o.pos.clone().setY(o.y + 0.7);
    s.position.copy(p);
    this.fxAdd(s, 0.6, k => { s.scale.setScalar(0.7 * (1 - k)); s.material.opacity = 0.6 * (1 - k); s.position.y = p.y + k * 0.3; });
  },
  moveImpact(T, c, big, a) {
    const p = T.clone().setY(1);
    this.flare(p, 0xffffff, 1.6 * big, 0.2);
    this.sparkle(p, c === 0xffffff ? 0xfff2c0 : c, Math.round(10 * big), 2.8 * big, 0.24);
    this.camShake = Math.max(this.camShake, 0.12 * big);
    // 当てられた側がのけぞる
    if (a?.tf && a.tf.alive && !a.tf.anim) {
      const h = this.startMove(a.tf.uid, "hurt");
      if (h) h.dir.copy(a.dir).multiplyScalar(-1); // 攻撃してきた方を向いたまま、後ろへ
    }
  },
  smallHit(T, c, i) {
    const p = T.clone().setY(0.8 + 0.25 * (i % 2));
    this.flare(p, 0xffffff, 0.9, 0.15);
    this.sparkle(p, 0xfff2c0, 5, 2, 0.18);
    this.hitStop = Math.max(this.hitStop, 0.04);
  },
  punchRing(T, c) {
    // 拳の当たったところに、カメラを向いた輪がはじける
    const m = new pt(FX_RING, fxMat(0xffffff, 0.9));
    m.position.copy(T.clone().setY(1));
    m.lookAt(this.camera.position);
    this.fxAdd(m, 0.28, k => { const s = 0.3 + k * 1.2; m.scale.set(s, s, 1); m.material.opacity = 0.9 * (1 - k); });
  },
  slashAt(T, c, size, rot) {
    const m = new pt(FX_ARC, fxMat(c, 1));
    m.position.copy(T.clone().setY(1));
    m.lookAt(this.camera.position);
    m.rotateZ(rot);
    this.fxAdd(m, 0.3, k => { const s = size * (0.6 + k * 0.6); m.scale.set(s, s, 1); m.rotateZ(0.15); m.material.opacity = 1 - k; });
  },
  clawMarks(T, c) {
    for (let i = -1; i <= 1; i++) {
      const m = new pt(geo().box, fxMat(i ? c : 0xffffff, 1));
      m.position.copy(T.clone().setY(1)).add(new D(i * 0.22, 0, 0));
      m.lookAt(this.camera.position);
      m.rotateZ(-0.6);
      this.fxAdd(m, 0.35, k => { m.scale.set(0.06, 1.3 * Math.min(1, k * 5), 0.01); m.material.opacity = 1 - k; });
    }
  },
  biteJaws(T) {
    for (const s of [-1, 1]) {
      const m = new pt(FX_ARC, fxMat(0xffffff, 1));
      m.position.copy(T.clone().setY(1));
      m.lookAt(this.camera.position);
      m.rotateZ(s > 0 ? Math.PI * 0.05 : Math.PI * 1.05);
      this.fxAdd(m, 0.3, k => { m.scale.set(0.8, 0.8, 1); m.position.y = 1 + s * 0.5 * (1 - Math.min(1, k * 3)); m.material.opacity = 1 - k; });
    }
  },
  starBurst(p) {
    for (let i = 0; i < 5; i++) {
      const s = this.textSprite("★", 0xf2d15c);
      const a0 = i / 5 * 6.28;
      this.fxAdd(s, 0.8, k => { s.position.set(p.x + Math.cos(a0 + k * 4) * 0.5, p.y + 0.2 * Math.sin(k * 6), p.z + Math.sin(a0 + k * 4) * 0.5); s.scale.setScalar(0.35); s.material.opacity = 1 - k; });
    }
  },
  groundCrack(T, c) {
    this.shockwave(T, c, 2.4, 0.5);
    this.shockwave(T, 0xd8c8a0, 1.4, 0.4);
    for (let i = 0; i < (this.reduced ? 2 : 7); i++) {
      const m = new pt(geo().box, new Aa({ color: 0x8a7a5a, transparent: !0 }));
      const ang = Math.random() * 6.28, sp = 1 + Math.random() * 1.6, vy = 2 + Math.random() * 2, p0 = T.clone().setY(0.1);
      m.scale.setScalar(0.1 + Math.random() * 0.12);
      this.fxAdd(m, 0.7, k => { const tt = k * 0.7; m.position.set(p0.x + Math.cos(ang) * sp * tt, Math.max(0.05, 0.1 + vy * tt - 6 * tt * tt), p0.z + Math.sin(ang) * sp * tt); m.rotation.set(k * 8, k * 6, 0); m.material.opacity = 1 - k * k; });
    }
    this.camShake = Math.max(this.camShake, 0.3);
  },
  thrustLine(T, d, c) {
    const m = new pt(FX_TUBE, fxMat(c, 0.9));
    const from = T.clone().setY(1).sub(d.clone().multiplyScalar(1.4)), to = T.clone().setY(1).add(d.clone().multiplyScalar(0.8));
    m.position.copy(from).lerp(to, 0.5);
    m.lookAt(to), m.rotateX(Math.PI / 2);
    const len = from.distanceTo(to);
    this.fxAdd(m, 0.25, k => { m.scale.set(0.05 * (1 - k), len, 0.05 * (1 - k)); m.material.opacity = 1 - k; });
  },
  missile(f, T, c, dur, big) {
    const from = f.root.position.clone().setY(1.1);
    const m = new pt(geo().sph, fxMat(big ? 0xffd0a0 : c === 0xffffff ? 0xd8e0ff : c, 1));
    m.scale.setScalar(big ? 0.28 : 0.14);
    this.fxAdd(m, dur, k => { m.position.lerpVectors(from, T.clone().setY(1), k); m.position.y += Math.sin(k * Math.PI) * (big ? 0.2 : 0.4); if (Math.random() < 0.7) this.flare(m.position.clone(), big ? 0xff9a4a : 0xffffff, big ? 0.9 : 0.5, 0.15); });
  },
  afterimage(f) {
    const p = f.root.position.clone();
    for (let i = 0; i < 3; i++) {
      const s = new Rl(new An({ map: this.glow(), color: 0xc8d8ff, transparent: !0, depthWrite: !1, blending: hi }));
      this.fxAdd(s, 0.4 + i * 0.1, k => { s.position.set(p.x, 0.9, p.z); s.scale.set(0.9, 1.6, 1); s.material.opacity = 0.4 * (1 - k); });
    }
  },
  shieldFlash(f) {
    const p = f.root.position, h = f.model.userData.height ?? 1.6;
    for (let i = 0; i < 2; i++) {
      const m = new pt(FX_HEX, fxMat(i ? 0xffffff : 0x9ad0ff, 0.9));
      m.position.set(p.x, h * 0.55, p.z);
      m.lookAt(this.camera.position);
      m.position.add(this.camera.position.clone().sub(m.position).setY(0).normalize().multiplyScalar(0.55));
      this.fxAdd(m, 0.45, k => { const s = (0.8 + i * 0.25) * h * (0.6 + 0.4 * easeOutK(k)); m.scale.set(s, s, 1); m.material.opacity = 0.9 * (1 - k); });
    }
  },
  soulOut(p) {
    // 本家の気絶：体から魂（白い玉としっぽ）が抜けて上がる
    const s = new Rl(new An({ map: this.glow(), color: 0xe8f0ff, transparent: !0, depthWrite: !1, blending: hi }));
    const tail = [];
    for (let i = 0; i < 4; i++) tail.push(new Rl(new An({ map: this.glow(), color: 0x9ad0ff, transparent: !0, depthWrite: !1, blending: hi })));
    const base = p.clone().setY(0.8);
    this.fxAdd(s, 1.6, k => { s.position.set(base.x + Math.sin(k * 7) * 0.25, base.y + k * 2.6, base.z); s.scale.setScalar(0.7 - k * 0.25); s.material.opacity = 1 - k; });
    tail.forEach((m, i) => this.fxAdd(m, 1.6, k => { const kk = Math.max(0, k - (i + 1) * 0.04); m.position.set(base.x + Math.sin(kk * 7) * 0.25, base.y + kk * 2.6, base.z); m.scale.setScalar((0.5 - i * 0.1) * (1 - k * 0.4)); m.material.opacity = 0.7 * (1 - k); }));
  },

  // ---- 字のスプライト（Z・♪・★・？など）----
  textSprite(ch, color) {
    this.txtTex ??= new Map();
    let tex = this.txtTex.get(ch);
    if (!tex) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 64;
      const g = cv.getContext("2d");
      g.font = `bold ${ch.length > 2 ? 22 : 46}px sans-serif`, g.textAlign = "center", g.textBaseline = "middle";
      g.lineWidth = 6, g.strokeStyle = "rgba(20,16,28,.9)", g.strokeText(ch, 32, 34);
      g.fillStyle = "#fff", g.fillText(ch, 32, 34);
      tex = new Tn(cv);
      this.txtTex.set(ch, tex);
    }
    return new Rl(new An({ map: tex, color, transparent: !0, depthWrite: !1 }));
  },
  floatText(f, ch, color, n = 1, size = 0.45) {
    const h = f.model.userData.height ?? 1.6, p = f.root.position.clone().setY(h + 0.1);
    for (let i = 0; i < n; i++) {
      const s = this.textSprite(ch, color), dx = (i - (n - 1) / 2) * 0.25;
      this.fxAdd(s, 1.1, k => {
        const kk = clamp01(k * 1.3 - i * 0.25);
        s.position.set(p.x + dx + Math.sin(kk * 5) * 0.12, p.y + kk * 0.9, p.z);
        s.scale.setScalar(size * (0.6 + i * 0.2) * (kk > 0 ? 1 : 0));
        s.material.opacity = Math.sin(kk * Math.PI);
      });
    }
  },
});

var FX_HEX = null;

// ---- 対戦の出来事 → モーション ----
(() => {
  const P = e2.prototype, prevCast = P.cast, prevAction = P.action, prevUpd = P.updateFigure, prevLine = P.setLine, prevKo = P.ko, prevGuard = P.guard, prevLoaf = P.loaf, prevHit = P.hit;
  FX_HEX ??= new M1(0.9, 1, 6, 1);
  P.action = function (uid, target, kind, color) {
    const f = this.figs.get(uid);
    if (!f || !f.def || (kind !== "attack" && kind !== "skill")) return prevAction.call(this, uid, target, kind, color);
    if (kind === "attack") {
      this.startMove(uid, attackMotionOf(f.def), { target, color: 0xffffff });
      this.sparkle(f.root.position.clone().setY(0.1), 0xd8d0c0, 5, 1.2, 0.3, 0.2, 0.5); // 踏み込みの土ぼこり
    } else {
      const heal = f.def.skillMode === "heal", drain = f.def.skillMode === "drain";
      this.startMove(uid, "cast", { target, color, element: f.def.skillElement ?? null, heal, drain, tier: spellTier(f.def), all: f.def.hskill === "トリプルヘッド" });
    }
  };
  // とりつき・術の構えのあいだは、もとの「その場で光る」動きで上書きしない
  P.cast = function (uid, color) {
    const f = this.figs.get(uid);
    if (f?.anim?.kind === "mv") { this.shockwave(f.root.position, color, 1.4, 0.5); return; }
    prevCast.call(this, uid, color);
  };
  P.possess = function (uid, target, good) {
    const f = this.figs.get(uid);
    if (!f || target == null || target === uid) return !1;
    return !!this.startMove(uid, "possess", { target, good });
  };
  P.guard = function (uid) {
    if (!this.startMove(uid, "guard")) prevGuard.call(this, uid);
  };
  P.loaf = function (uid) {
    const f = this.figs.get(uid);
    if (!f || !this.startMove(uid, "loaf", { loaf: loafStyleOf(f.def) })) prevLoaf.call(this, uid);
  };
  P.dodge = function (uid, from) {
    const f = this.figs.get(uid);
    if (!f || f.anim) return;
    const a = this.startMove(uid, "dodge");
    const src = from != null ? this.figs.get(from) : null;
    if (a && src) a.dir.copy(f.home.clone().sub(src.home).setY(0).normalize());
  };
  P.ko = function (uid) {
    prevKo.call(this, uid);
    const f = this.figs.get(uid);
    if (!f) return;
    const foeSide = [...this.figs.values()].filter(o => o.ally !== f.ally && o.root.visible);
    const c = foeSide.length ? foeSide.reduce((s, o) => s.add(o.home), new D()).multiplyScalar(1 / foeSide.length) : f.home.clone().add(new D(0, 0, f.ally ? -3 : 3));
    const a = this.startMove(uid, "ko", { ally: f.ally });
    if (a) a.dir.copy(c.sub(f.home).setY(0).normalize());
  };
  P.hit = function (uid, crit, color) {
    prevHit.call(this, uid, crit, color);
    const f = this.figs.get(uid);
    if (f && f.alive && !f.anim) this.startMove(uid, "hurt");
  };
  // ホイールで前に出てきた妖怪は、跳んで着地する
  P.setLine = function (ally, uids) {
    const was = new Set([...this.figs.values()].filter(o => o.ally === ally && o.root.visible).map(o => o.uid));
    prevLine.call(this, ally, uids);
    if (!this.lineInit?.[ally ? 1 : 0]) { (this.lineInit ??= [0, 0])[ally ? 1 : 0] = 1; return; }
    for (const u of uids) {
      const f = this.figs.get(u);
      if (f && !was.has(u) && f.alive && (!f.anim || f.anim.kind === "mv")) this.startMove(u, "enter", { ally, tribe: typeof Pi !== "undefined" && f.def ? N2(Pi[f.def.tribe]) : 0xf2d15c });
    }
  };
  // 勝ち負けのポーズ（決着のあと、何度か）
  P.celebrate = function (winnerAlly) {
    for (const f of this.figs.values()) {
      if (!f.root.visible || !f.alive) continue;
      const win = winnerAlly === null ? false : f.ally === winnerAlly;
      this.startMove(f.uid, win ? "cheer" : "slump");
    }
  };
  P.updateFigure = function (f, dt) {
    const a = f.anim;
    if (!a || a.kind !== "mv") {
      prevUpd.call(this, f, dt);
      if (!a && f.alive && f.root.visible) idlePose(this, f);
      return;
    }
    if (!f.root.visible) { f.anim = null; return; }
    a.t += dt;
    const k = Math.min(1, a.t / a.dur), o = this.mvPose(f, a, k, dt), m = f.model;
    f.root.position.copy(o.pos);
    m.position.y = o.y;
    m.rotation.set(o.rx, (o.face ?? f.baseYaw) + o.spin, f.ally ? -o.rz : o.rz);
    m.scale.set(o.sx, o.sy, o.sx);
    f.shake > 0 && (f.root.position.x += Math.sin(this.clock * 70) * f.shake * 0.12, f.shake = Math.max(0, f.shake - dt * 3));
    f.flash = Math.max(0, f.flash - dt * 4);
    setModelLook(m, f.flash, f.alive || a.style === "ko" ? o.op : 0.25);
    animateModel(m, this.clock + f.phase);
    poseLimbs(m, o);
    f.shadow.material.opacity = Math.max(0.05, 0.35 * o.op - Math.min(0.2, o.y * 0.1));
    if (k >= 1) {
      f.anim = null;
      m.rotation.set(0, f.baseYaw, 0), m.scale.set(1, 1, 1), m.position.y = 0;
      poseLimbs(m, null);
    }
  };
})();

// 腕・頭を姿勢に合わせる（animateModel のゆらゆらに足す）
function poseLimbs(m, o) {
  const ud = m.userData, arms = ud.arms ?? [];
  if (arms[0]) arms[0].rotation.x += o ? o.armL : 0, arms[0].rotation.y = o ? -o.armZ : 0;
  if (arms[1]) arms[1].rotation.x += o ? o.armR : 0, arms[1].rotation.y = o ? o.armZ : 0;
  if (ud.headObj) ud.headObj.rotation.x = o ? o.head : 0;
}
// 待機中：ときどき首をかしげて、まわりを見る
function idlePose(scene, f) {
  const h = f.model.userData.headObj;
  if (!h) return;
  const t = scene.clock + f.phase * 3;
  h.rotation.y = Math.sin(t * 0.7) * 0.25 * Math.max(0, Math.sin(t * 0.23));
  h.rotation.x = 0;
}

// 決着のあと 1.5 秒：勝った側はよろこび、負けた側はうなだれる（対戦の進みは止まっているので、絵だけ動かす）
function endPoses(g, winner) {
  const sc = g.scene;
  if (!sc?.celebrate) return;
  sc.celebrate(winner === 0 ? true : winner === 1 ? false : null);
  const t0 = performance.now();
  let last = t0;
  const step = now => {
    if (now - t0 > 1450 || !sc.figs) return;
    sc.update(Math.min(0.05, (now - last) / 1e3)), last = now;
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// 対戦の出来事から：とりつく（相手へ飛んでいく）・よける（横に跳ぶ）
(() => {
  const prev = Od;
  Od = function (e, t) {
    const sc = e.scene;
    if (t.t === "action" && (t.action === "curse" || t.action === "bless") && t.dst != null) sc.possess?.(t.uid, t.dst, t.action === "bless");
    else if (t.t === "evade") sc.dodge?.(t.uid, null);
    return prev(e, t);
  };
})();
