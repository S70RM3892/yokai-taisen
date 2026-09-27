// 流行りの型（src/ext/presets.js の PRESETS と META_PRESETS）どうしを、いちばん強い CPU（アイテムなし＝対人戦と同じ）で
// 総当たりさせて勝率を出す。メタの型を考えるときの目安（CPU の動きなので、人どうしの対戦とは差がある）。
//   node tools/build.mjs --engine-only && node tools/meta_sim.mjs [1 組あたりの対戦数（左右入れかえて 2 倍）] [--random 数]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = require(join(root, "dist", "engine.cjs"));
const args = process.argv.slice(2);
const per = Number(args.find(a => /^\d+$/.test(a)) ?? 6);
const nRandom = Number(args[args.indexOf("--random") + 1] ?? 0) || (args.includes("--random") ? 20 : 0);

// presets.js の配列だけを取り出して読む（画面の部分は使わない）
const src = readFileSync(join(root, "src", "ext", "presets.js"), "utf8");
const grab = name => {
  const i = src.indexOf(`var ${name} = [`);
  if (i < 0) return [];
  let d = 0, j = src.indexOf("[", i);
  for (let k = j; k < src.length; k++) { if (src[k] === "[") d++; else if (src[k] === "]" && --d === 0) return Function(`return ${src.slice(j, k + 1)}`)(); }
  throw new Error(`cannot read ${name}`);
};
const toMembers = p => p.team.map(([name, nature, eq, eq2]) => {
  const d = E.units.find(x => x.name === name);
  if (!d) throw new Error(`${p.name}: ${name} がいない`);
  const ref = e => e?.startsWith("soul:") ? "soul:" + E.units.find(x => x.name === e.slice(5)).id : e;
  const m = { unit: d.id, nature, diligence: "choumajime" };
  if (eq) m.equipment = ref(eq);
  if (eq2) m.equipment2 = ref(eq2);
  return m;
});
const smart = { perfectPermil: 1000, pokeHitPermil: 950, grandPermil: 1000, smart: true, itemPermil: 0 };

const teams = [...grab("PRESETS").map(p => ({ name: p.name, meta: false, m: toMembers(p) })), ...grab("META_PRESETS").map(p => ({ name: p.name, meta: true, m: toMembers(p) }))];
for (let i = 0; i < nRandom; i++) teams.push({ name: `ランダム${i + 1}`, meta: false, random: true, m: E.randomTeam(E.seedRng(9000 + i, 1)) });
let bad = 0;
for (const t of teams) { const errs = E.validateTeam(t.m); if (errs.length) { console.log(`NG ${t.name}: ${errs.join(" / ")}`); bad++; } }
if (bad) process.exit(1);

function play(a, b, seed) {
  const st = E.newBattle(seed, a, b, { noItems: true });
  const cpus = [E.newCpu(0, seed ^ 11, smart), E.newCpu(1, seed ^ 22, smart)];
  for (let g = 0; !st.outcome && g < 30000; g++) {
    const inputs = [];
    for (const p of [0, 1]) for (const input of E.cpuInputs(cpus[p], st)) inputs.push({ player: p, input });
    E.step(st, inputs, []);
  }
  return st.outcome?.winner ?? null;
}

const n = teams.length, score = teams.map(() => ({ w: 0, l: 0, d: 0 })), vs = teams.map(() => teams.map(() => 0));
const t0 = Date.now();
for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
  if (teams[i].random && teams[j].random) continue;
  for (let k = 0; k < per; k++) for (const swap of [0, 1]) {
    const seed = (i * 7919 + j * 104729 + k * 13 + swap) >>> 0;
    const [A, B] = swap ? [j, i] : [i, j];
    const w = play(teams[A].m, teams[B].m, seed);
    if (w === null) { score[A].d++, score[B].d++; continue; }
    const W = w === 0 ? A : B, L = w === 0 ? B : A;
    score[W].w++, score[L].l++, vs[W][L]++;
  }
}
const rate = s => (s.w + s.d / 2) / Math.max(1, s.w + s.l + s.d);
const order = teams.map((t, i) => i).filter(i => !teams[i].random).sort((a, b) => rate(score[b]) - rate(score[a]));
console.log(`${per * 2} games per pair, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const i of order) {
  const s = score[i], worst = teams.map((t, j) => j).filter(j => j !== i && !teams[j].random).map(j => [j, vs[i][j] - vs[j][i]]).sort((a, b) => a[1] - b[1])[0];
  const best = teams.map((t, j) => j).filter(j => j !== i && !teams[j].random).map(j => [j, vs[i][j] - vs[j][i]]).sort((a, b) => b[1] - a[1])[0];
  const hh = j => `${vs[i][j]}-${vs[j][i]}`;
  console.log(`${(rate(s) * 100).toFixed(0).padStart(3)}%  ${teams[i].meta ? "★" : " "} ${teams[i].name}  (${s.w}-${s.l}-${s.d})  得意: ${best ? `${teams[best[0]].name} ${hh(best[0])}` : "-"}  苦手: ${worst ? `${teams[worst[0]].name} ${hh(worst[0])}` : "-"}`);
}
if (args.includes("--json")) console.log(JSON.stringify(Object.fromEntries(order.map(i => [teams[i].name, Math.round(rate(score[i]) * 100)]))));
