// 人どうしの対戦をまねる CPU（tools/top100.mjs --human で使う。ゲームの CPU は変えない）。
// いちばん強い CPU（smart）の入力をもとに、人のプレイヤーがすることと できないことを足す。
//   - メンバーサークル回し：妖気がたまった後衛を前に出してひっさつわざを撃つ・とりつかれた／HP の少ない前衛を下げる。
//     回す向きと歩数（1〜5）は、回したあとの並びを点数にして いちばんよいものを選ぶ（よくならなければ回さない）
//   - ノーモーション・カウンター：妖気がたまったら、だれかのモーション中にパワーチャージを始める（2 秒待ってもなければ そのまま始める）
//   - 人の限界：判断は 0.2〜0.4 秒ごと（ミニゲームの入力は毎 tick）。パワーチャージの完璧は 75%・つつくの命中 70%・おはらいの連打は CPU より遅い
export const HUMAN_PARAMS = { perfectPermil: 750, pokeHitPermil: 700, grandPermil: 1000, smart: true, itemPermil: 0, purifyRate: 16 };
const SG_FULL = 1000, WAIT_MOTION = 40, MINIGAME = new Set(["ultCharge", "purifyTap", "pokeTap", "ultRelease", "ultCancel", "pokeStop"]);

export function newHuman(E, player, seed) {
  return { E, player, base: E.newCpu(player, seed, HUMAN_PARAMS), rs: (seed * 2654435761 + 1) >>> 0 || 1, nextThink: 0, readySince: null };
}
function rand(h) { h.rs ^= h.rs << 13; h.rs >>>= 0; h.rs ^= h.rs >>> 17; h.rs ^= h.rs << 5; h.rs >>>= 0; return h.rs / 4294967296; }

const alive = u => u.hp > 0;
function unitValue(u, front) {
  if (!alive(u)) return 0;
  const hp = u.hp / u.maxHp;
  if (!front) return u.curse ? 3 : 0; // 後衛にいれば おはらいできる
  let v = 10 + 6 * hp;
  if (u.curse) v -= 12;
  else if (u.sg >= SG_FULL && !(u.ultLockout > 0)) v += 8;
  if (hp < 0.25) v -= 5;
  return v;
}
function wheelValue(p, wheel) {
  let v = 0;
  for (let i = 0; i < 6; i++) v += unitValue(p.units[wheel[i]], i < 3);
  return v;
}
// cw で k 歩：old[d] → (d + k) % 6。ccw は 6 - k 歩ぶんの cw と同じ
function rotated(wheel, dir, k) {
  const s = dir === "cw" ? k : 6 - k, out = new Array(6);
  for (let d = 0; d < 6; d++) out[(d + s) % 6] = wheel[d];
  return out;
}
function chooseRotate(h, st) {
  const p = st.players[h.player];
  if (p.stance || p.poke || p.pendingRotate || p.rotateCooldown > 0) return null;
  const now = wheelValue(p, p.wheel);
  let best = null, bestV = now + 6;
  for (const dir of ["cw", "ccw"]) for (let k = 1; k <= 5; k++) {
    const v = wheelValue(p, rotated(p.wheel, dir, k)) - 0.5 * k;
    if (v > bestV) bestV = v, best = { t: "rotate", dir, steps: k };
  }
  return best && rand(h) < 0.9 ? best : null;
}

export function humanInputs(h, st) {
  const all = h.E.cpuInputs(h.base, st);
  const out = all.filter(x => MINIGAME.has(x.t));
  const p = st.players[h.player];
  const ready = [0, 1, 2].some(i => { const u = p.units[p.wheel[i]]; return alive(u) && u.sg >= SG_FULL && !u.curse; });
  if (!ready) h.readySince = null;
  else if (h.readySince === null) h.readySince = st.tick;
  if (st.tick < h.nextThink) return out;
  h.nextThink = st.tick + 4 + Math.floor(rand(h) * 5);
  const rot = chooseRotate(h, st);
  if (rot) { out.push(rot); return out; } // 回すときは 並びが決まってから次を考える
  for (const x of all) {
    if (MINIGAME.has(x.t) || x.t === "rotate") continue;
    if (x.t === "ultStart") {
      const motion = st.tick < st.busyUntil;
      if (!motion && st.tick - (h.readySince ?? st.tick) < WAIT_MOTION) continue;
    }
    out.push(x);
  }
  return out;
}
