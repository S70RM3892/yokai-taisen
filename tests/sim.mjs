// CPU どうしを大量に対戦させて、対戦ロジックが最後まで壊れずに動くかを確かめる。
//   node tools/build.mjs --engine-only && node tests/sim.mjs [対戦数]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../dist/engine.cjs");

const games = Number(process.argv[2] ?? 300);
const levels = [
  { perfectPermil: 150, pokeHitPermil: 150, grandPermil: 0 },
  { perfectPermil: 500, pokeHitPermil: 400, grandPermil: 500 },
  { perfectPermil: 1000, pokeHitPermil: 950, grandPermil: 1000, smart: true },
];

let wins = [0, 0, 0], reasons = {}, events = {}, ticks = 0;
const used = new Set();
const t0 = Date.now();
for (let g = 0; g < games; g++) {
  const seed = (g * 2654435761) >>> 0;
  const rng = E.seedRng(seed, 5);
  const teams = [E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2))];
  for (const t of teams) for (const m of t) used.add(m.unit);
  for (const t of teams) {
    const errs = E.validateTeam(t);
    if (errs.length) throw new Error(`bad random team: ${errs.join(" / ")}`);
  }
  const st = E.newBattle(seed, teams[0], teams[1]);
  const cpus = [E.newCpu(0, E.nextRand(rng), levels[g % 3]), E.newCpu(1, E.nextRand(rng), levels[(g + 1) % 3])];
  let guard = 0;
  while (!st.outcome) {
    const inputs = [];
    for (const p of [0, 1]) for (const input of E.cpuInputs(cpus[p], st)) inputs.push({ player: p, input });
    const ev = [];
    E.step(st, inputs, ev);
    for (const e of ev) events[e.t] = (events[e.t] ?? 0) + 1;
    for (const pl of st.players) for (const u of pl.units) {
      if (!(u.hp >= 0 && u.hp <= u.maxHp) || !Number.isFinite(u.ap) || !(u.sg >= 0 && u.sg <= 1000)) {
        throw new Error(`game ${g} tick ${st.tick}: broken unit ${JSON.stringify({ hp: u.hp, maxHp: u.maxHp, ap: u.ap, sg: u.sg })}`);
      }
    }
    if (++guard > 20000) throw new Error(`game ${g} did not finish`);
  }
  ticks += st.tick;
  wins[st.outcome.winner === null ? 2 : st.outcome.winner]++;
  reasons[st.outcome.reason] = (reasons[st.outcome.reason] ?? 0) + 1;
}
console.log(`${games} games in ${Date.now() - t0} ms, avg ${(ticks / games / 20).toFixed(1)} s`);
console.log("P1 / P2 / draw:", wins.join(" / "), " reasons:", JSON.stringify(reasons));
console.log(`units used: ${used.size} / ${E.units.length}`);
console.log("events:", Object.entries(events).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(" "));
if (E.extraChecks) E.extraChecks();
