// 人どうしの対戦をまねる CPU（tools/top100.mjs --human・tools/counter.mjs で使う。ゲームの CPU は変えない）。
// いちばん強い CPU（smart）の入力をもとに、人のプレイヤーがすることと できないことを足す。
//   - メンバーサークル回し：妖気がたまった後衛を前に出してひっさつわざを撃つ・とりつかれた／HP の少ない前衛を下げる。
//     回す向きと歩数（1〜5）は、回したあとの並びを点数にして いちばんよいものを選ぶ（よくならなければ回さない）
//   - ノーモーション・カウンター：妖気がたまったら、だれかのモーション中にパワーチャージを始める（2 秒待ってもなければ そのまま始める）
//   - 人の限界：判断は 0.2〜0.4 秒ごと（ミニゲームの入力は毎 tick）。パワーチャージの完璧は 75%・つつくの命中 70%・おはらいの連打は CPU より遅い
// 操作の方針は数値（THETA）で決まる。tools/counter.mjs はこの数値を編成といっしょに進化させて「最強の操作」を探す。
export const HUMAN_PARAMS = { perfectPermil: 750, pokeHitPermil: 700, grandPermil: 1000, smart: true, itemPermil: 0, purifyRate: 16 };
export const PERFECT_PARAMS = { perfectPermil: 1000, pokeHitPermil: 950, grandPermil: 1000, smart: true, itemPermil: 0, purifyRate: 20 };
// 操作の方針。[下限, 上限, 人のモデルの値, 説明]
export const THETA_SPEC = {
  base: [5, 20, 10, "前衛で動ける妖怪 1 体の点"],
  hp: [0, 15, 6, "前衛の HP の割合の重み"],
  curse: [0, 25, 12, "とりつかれた妖怪が前衛にいるときの減点"],
  ult: [0, 20, 8, "妖気がたまった妖怪が前衛にいるときの加点"],
  lowHp: [0, 0.6, 0.25, "HP がこれより少ない前衛は下げたい（割合）"],
  lowHpPen: [0, 15, 5, "↑の減点"],
  backCurse: [0, 8, 3, "とりつかれた妖怪が後衛にいる（おはらいできる）ときの加点"],
  rotThresh: [0, 15, 6, "これだけ点が上がるときだけ回す"],
  stepCost: [0, 2, 0.5, "回す 1 歩あたりの減点"],
  ultWait: [0, 80, 40, "ひっさつわざを だれかのモーション中まで待つ最長 tick（20 tick＝1 秒）"],
  think: [1, 8, 4, "判断の間隔の最小 tick"],
  thinkJit: [0, 8, 4, "判断の間隔のゆれ（tick）"],
  skipImmune: [0, 1, 0, "0.5 より大きいと、相手の前衛がみんな ひっさつわざを受けない（かたすかし）ならひっさつわざを撃たない"],
  ownTarget: [0, 1, 0, "0.5 より大きいと、ねらう相手を下の重みで自分で選ぶ（小さいとふつうの CPU と同じ）"],
  tWeak: [0, 1500, 300, "こちらの前衛の術の属性が弱点の相手を ねらいやすく"],
  tCurse: [0, 1500, 300, "とりつかれ・サボり中の相手を ねらいやすく"],
  tGuard: [0, 600, 150, "ガード中の相手を ねらいにくく"],
  tAtk: [0, 1500, 0, "ちから・ようりょくの高い相手を ねらいやすく"],
  tImmune: [0, 1500, 0, "ひっさつわざを受けない相手を ねらいやすく（ひっさつわざで倒せないぶん こうげきで）"],
};
export const THETA0 = Object.fromEntries(Object.entries(THETA_SPEC).map(([k, v]) => [k, v[2]]));
const SG_FULL = 1000, MINIGAME = new Set(["ultCharge", "purifyTap", "pokeTap", "ultRelease", "ultCancel", "pokeStop"]);

export function newHuman(E, player, seed, theta = THETA0, params = HUMAN_PARAMS) {
  return { E, player, th: { ...THETA0, ...theta }, base: E.newCpu(player, seed, params), rs: (seed * 2654435761 + 1) >>> 0 || 1, nextThink: 0, readySince: null };
}
function rand(h) { h.rs ^= h.rs << 13; h.rs >>>= 0; h.rs ^= h.rs >>> 17; h.rs ^= h.rs << 5; h.rs >>>= 0; return h.rs / 4294967296; }

const alive = u => u.hp > 0;
function unitValue(th, u, front) {
  if (!alive(u)) return 0;
  const hp = u.hp / u.maxHp;
  if (!front) return u.curse ? th.backCurse : 0; // 後衛にいれば おはらいできる
  let v = th.base + th.hp * hp;
  if (u.curse) v -= th.curse;
  else if (u.sg >= SG_FULL && !(u.ultLockout > 0)) v += th.ult;
  if (hp < th.lowHp) v -= th.lowHpPen;
  return v;
}
function wheelValue(th, p, wheel) {
  let v = 0;
  for (let i = 0; i < 6; i++) v += unitValue(th, p.units[wheel[i]], i < 3);
  return v;
}
// cw で k 歩：old[d] → (d + k) % 6。ccw は 6 - k 歩ぶんの cw と同じ
function rotated(wheel, dir, k) {
  const s = dir === "cw" ? k : 6 - k, out = new Array(6);
  for (let d = 0; d < 6; d++) out[(d + s) % 6] = wheel[d];
  return out;
}
function chooseRotate(h, st) {
  const p = st.players[h.player], th = h.th;
  if (p.stance || p.poke || p.pendingRotate || p.rotateCooldown > 0) return null;
  const now = wheelValue(th, p, p.wheel);
  let best = null, bestV = now + th.rotThresh;
  for (const dir of ["cw", "ccw"]) for (let k = 1; k <= 5; k++) {
    const v = wheelValue(th, p, rotated(p.wheel, dir, k)) - th.stepCost * k;
    if (v > bestV) bestV = v, best = { t: "rotate", dir, steps: k };
  }
  return best && rand(h) < 0.9 ? best : null;
}
const front = p => [0, 1, 2].map(i => p.units[p.wheel[i]]).filter(alive);
function chooseTarget(h, st) {
  const E = h.E, th = h.th, p = st.players[h.player], q = st.players[1 - h.player];
  if (p.targetCooldown > 0) return null;
  const elems = new Set(front(p).map(u => E.units[u.defIndex].skillElement).filter(Boolean));
  let best = null, bs = Infinity;
  for (const u of front(q)) {
    const d = E.units[u.defIndex];
    let w = 1000;
    if (d.weak && elems.has(d.weak)) w += th.tWeak;
    if (u.curse || u.loafing) w += th.tCurse;
    if (u.guarding) w -= th.tGuard;
    w += th.tAtk * Math.max(d.atk, d.spa) / 200;
    if (u.fx?.ultImmune) w += th.tImmune;
    const s = u.hp / u.maxHp / Math.max(50, w);
    if (s < bs) bs = s, best = u;
  }
  return best && best.index !== p.target ? { t: "target", enemyUnit: best.index } : null;
}

export function humanInputs(h, st) {
  const th = h.th, all = h.E.cpuInputs(h.base, st);
  const out = all.filter(x => MINIGAME.has(x.t));
  const p = st.players[h.player];
  const ready = [0, 1, 2].some(i => { const u = p.units[p.wheel[i]]; return alive(u) && u.sg >= SG_FULL && !u.curse; });
  if (!ready) h.readySince = null;
  else if (h.readySince === null) h.readySince = st.tick;
  if (st.tick < h.nextThink) return out;
  h.nextThink = st.tick + Math.round(th.think) + Math.floor(rand(h) * (Math.round(th.thinkJit) + 1));
  const rot = chooseRotate(h, st);
  if (rot) { out.push(rot); return out; } // 回すときは 並びが決まってから次を考える
  const own = th.ownTarget > 0.5;
  if (own) { const t = chooseTarget(h, st); if (t) out.push(t); }
  const immune = th.skipImmune > 0.5 && front(st.players[1 - h.player]).every(u => u.fx?.ultImmune);
  for (const x of all) {
    if (MINIGAME.has(x.t) || x.t === "rotate" || (own && x.t === "target")) continue;
    if (x.t === "ultStart") {
      if (immune) continue;
      const motion = st.tick < st.busyUntil;
      if (!motion && st.tick - (h.readySince ?? st.tick) < th.ultWait) continue;
    }
    out.push(x);
  }
  return out;
}
