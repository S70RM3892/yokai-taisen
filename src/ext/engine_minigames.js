// ============================================================================
// 本家のタッチアクションを対戦ロジックに入れる。
//   ひっさつわざのパワーチャージ（4 種）：まわせ！・なぞれ！・打て！・あわせろ！
//     ゲージが満タンになったら発動。早いほど PERFECT（威力アップ）、時間切れは MISS。
//   おはらい（5 種）：つぶせ・連打・こすれ・まわせ・斬れ
//     何もしなくても少しずつ進むが、タッチアクションで一気に進む。
// 出典：攻略大百科「ひっさつわざの使い方」、ゲームエイト「バトルシステムと戦闘のコツ」
// ============================================================================

var CHARGE_GAMES = {
  mawase: { name: "まわせ！", help: "円の中をぐるぐる回す", perfect: 45, good: 75, limit: 110 },
  nazore: { name: "なぞれ！", help: "光る点を順になぞって 3 周", perfect: 70, good: 110, limit: 150 },
  ute: { name: "打て！", help: "飛んでくる黄色い玉をタップ", perfect: 60, good: 95, limit: 130 },
  awasero: { name: "あわせろ！", help: "針が光る目もりに来たら押す（3 回）", perfect: 52, good: 84, limit: 120 },
};
var CHARGE_KEYS = ["mawase", "nazore", "ute", "awasero"];
var PURIFY_GAMES = {
  tsubuse: { name: "つぶせ！", help: "出てくる泡をタップしてつぶす" },
  renda: { name: "連打！", help: "光っているところを連打" },
  kosure: { name: "こすれ！", help: "鎖をこすって削る" },
  mawase: { name: "まわせ！", help: "円をぐるぐる回す" },
  kire: { name: "斬れ！", help: "ヒビの入ったところをなぞって斬る" },
};
var PURIFY_KEYS = ["tsubuse", "renda", "kosure", "mawase", "kire"];
var CHARGE_FULL = 1000, PURIFY_FULL = 1000, PURIFY_IDLE = 5, MAX_TAP = 300;

function chargeInput(p, amount) {
  const s = p.stance;
  if (!s || !gr(amount, 1, MAX_TAP)) return false;
  s.power = Math.min(CHARGE_FULL, s.power + amount);
  return true;
}

// あわせろ！：光る目もり（tick を 16 で割ったあまりが perfect / good の窓）で押す
// at：押した瞬間に画面で見えていた tick（対人戦で通信の遅れの分を戻す。1 秒より古いものは使わない）
function awaseroPress(state, p, at) {
  const s = p.stance;
  if (!s || s.game !== "awasero") return false;
  const when = Number.isInteger(at) && at <= state.tick && at >= state.tick - 20 && at >= s.startTick ? at : state.tick;
  if (when - (s.lastPress ?? -99) < 4) return false;
  s.lastPress = when;
  const n = (when - s.startTick) % Di;
  const add = iu.includes(n) ? 340 : nu.includes(n) ? 260 : 0;
  s.power = Math.min(CHARGE_FULL, s.power + add);
  s.lastJudge = add >= 340 ? "perfect" : add > 0 ? "good" : "miss";
  return true;
}

// 満タン（または時間切れ）で発動するかどうか。発動するなら [quality, chargeMult, auto]
function chargeResult(state, s) {
  const g = CHARGE_GAMES[s.game] ?? CHARGE_GAMES.awasero;
  const t = state.tick - s.startTick;
  if (s.power >= CHARGE_FULL) return [t <= g.perfect ? "perfect" : t <= g.good ? "good" : "miss", 1100, false];
  if (t > g.limit) return ["miss", 1000, true];
  return null;
}

function purifyInput(p, amount) {
  const pu = p.purify;
  if (!pu || !gr(amount, 1, MAX_TAP)) return false;
  const u = p.units[pu.unit];
  pu.progress += Math.floor(amount * (1e3 + (u.fx.purifyFast ?? 0)) / 1e3);
  return true;
}

// CPU：ゲージを毎 tick 少しずつためる（強い CPU ほど速い）
function cpuChargeInputs(cpu, state, out) {
  const p = state.players[cpu.player];
  if (p.stance) {
    if (cpu.chargeFor !== p.stance.startTick) {
      cpu.chargeFor = p.stance.startTick;
      const g = CHARGE_GAMES[p.stance.game];
      const perfect = gt(cpu.rng, 1e3) < cpu.params.perfectPermil;
      const span = perfect ? g.perfect - 12 : g.good - 5 + gt(cpu.rng, 30);
      cpu.chargeRate = Math.max(1, Math.ceil(CHARGE_FULL / Math.max(8, span)));
    }
    out.push({ t: "ultCharge", amount: cpu.chargeRate });
  }
  if (p.purify) out.push({ t: "purifyTap", amount: cpu.params.purifyRate ?? 20 });
}
