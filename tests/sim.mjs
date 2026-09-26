// CPU どうしを大量に対戦させて、対戦ロジックが最後まで壊れずに動くかを確かめる。
//   node tools/build.mjs --engine-only && node tests/sim.mjs [対戦数]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../dist/engine.cjs");

const games = Number(process.argv[2] ?? 300);
const levels = [
  { perfectPermil: 150, pokeHitPermil: 150, grandPermil: 0, itemPermil: 20 },
  { perfectPermil: 500, pokeHitPermil: 400, grandPermil: 500, itemPermil: 150 },
  { perfectPermil: 1000, pokeHitPermil: 950, grandPermil: 1000, smart: true, itemPermil: 1000 },
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
  const st = E.newBattle(seed, teams[0], teams[1], { bags: [E.randomBag(E.seedRng(seed, 3)), E.randomBag(E.seedRng(seed, 4))] });
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
// 全員の特性・魂・装備を確かめる
const tNames = new Set();
let equipPairs = 0;
for (const d of E.units) {
  const t = E.traitOf(d);
  if (!t || !t.name || !t.desc) throw new Error(`no trait for ${d.id}`);
  if (tNames.has(t.name)) throw new Error(`dup trait name ${t.name}`);
  tNames.add(t.name);
  if (!t.soulDesc) throw new Error(`empty soul for ${d.id}`);
  for (const eq of E.equipChoices(d)) {
    const m = E.memberStats({ unit: d.id, equipment: eq.id });
    for (const k of ["maxHp", "atk", "spa", "def", "spd"]) if (!(m[k] >= 1)) throw new Error(`bad stat ${d.id} ${eq.id} ${k}=${m[k]}`);
    equipPairs++;
  }
}
const cats = {};
for (const e of E.equips) cats[e.cat] = (cats[e.cat] ?? 0) + 1;
console.log(`traits: ${tNames.size} unique, equipment: ${E.equips.length} (${JSON.stringify(cats)}), allowed pairs ${equipPairs}, battle items: ${E.battleItems.length}`);

// 対人戦の前提：同じ種・同じ入力なら、JSON で送った状態からでも同じ結果になる（ゲストの再現）。
// アイテムはなし。持ち物（装備）はそのまま効く。「あわせろ！」の at は過去 1 秒まで・構えより前には戻れない。
{
  let pvp = 0;
  for (let g = 0; g < 20; g++) {
    const seed = (g * 40503 + 7) >>> 0;
    const teams = [E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2))];
    const bags = [["ikuraonigiri"], ["ikuraonigiri"]];
    const host = E.newBattle(seed, teams[0], teams[1], { noItems: true, bags });
    let guest = E.newBattle(seed, teams[0], teams[1], { noItems: true, bags });
    if (host.players[0].bag.length || host.players[1].bag.length) throw new Error("pvp has no items");
    const cpus = [E.newCpu(0, seed ^ 1, levels[2]), E.newCpu(1, seed ^ 2, levels[1])];
    while (!host.outcome) {
      const inputs = [];
      for (const p of [0, 1]) for (const input of E.cpuInputs(cpus[p], host)) inputs.push({ player: p, input });
      inputs.push({ player: 1, input: { t: "item", slot: 0, allySlot: 0 } });
      const ev = [];
      E.step(host, inputs, ev);
      if (ev.some(e => e.t === "item")) throw new Error("item used in pvp");
      E.step(guest, JSON.parse(JSON.stringify(inputs)), []);
      if (host.tick % 97 === 0) guest = JSON.parse(JSON.stringify(guest)); // 送られた状態に置きかえても同じ
    }
    if (JSON.stringify(host) !== JSON.stringify(guest)) throw new Error(`pvp replay diverged in game ${g}`);
    pvp++;
  }
  // 持ち物（装備）は対人戦でも効く
  {
    const t = E.randomTeam(E.seedRng(1, 1)), foe = E.randomTeam(E.seedRng(2, 1));
    const d = E.units.find(x => x.id === t[0].unit);
    const eqId = E.equipChoices(d).find(q => q.id === "jugon_katana") ? "jugon_katana" : E.equipChoices(d)[0].id;
    const withEq = t.map((m, i) => i ? m : { ...m, equipment: eqId });
    const a = E.newBattle(3, t.map((m, i) => i ? m : { ...m, equipment: undefined }), foe, { noItems: true }), b = E.newBattle(3, withEq, foe, { noItems: true });
    const ua = a.players[0].units[0], ub = b.players[0].units[0];
    if (ub.equipment !== eqId || ["atk", "spa", "def", "spd", "maxHp"].every(k => ua[k] === ub[k]) && JSON.stringify(ua.eq) === JSON.stringify(ub.eq)) throw new Error("equipment not applied in pvp");
  }
  // at の範囲
  const seed = 99, teams = [E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2))];
  const st = E.newBattle(seed, teams[0], teams[1], { noItems: true });
  for (let i = 0; i < 40; i++) E.step(st, [], []);
  const p = st.players[0];
  p.stance = { unit: p.wheel[0], startTick: 30, grand: false, partners: [], releaseRequested: false, game: "awasero", power: 0 };
  E.step(st, [{ player: 0, input: { t: "ultRelease", at: 5 } }], []);
  if (p.stance && p.stance.lastPress !== 40) throw new Error(`at before stance should fall back to now: ${p.stance.lastPress}`);
  E.step(st, [{ player: 0, input: { t: "ultRelease", at: 38 } }], []);
  if (p.stance && p.stance.lastPress !== 40) throw new Error("press within 4 ticks should be ignored");
  console.log(`pvp replay: ${pvp} games identical, no items, equipment applied`);
}

// 足した妖怪の特性：油差し（回転の待ちが短い）・順送り（となりの番が早まる）
{
  const id = n => E.units.find(u => u.name === n).id;
  const base = ["牛打ち坊", "塗仏", "大入道", "石妖", "殺生石", "岩魚坊主"].map(n => ({ unit: id(n) }));
  const withOil = base.map((m, i) => i === 5 ? { unit: id("油坊") } : m);
  const cd = team => { const s = E.newBattle(7, team, base, { noItems: true }); E.step(s, [{ player: 0, input: { t: "rotate", dir: "cw", steps: 1 } }], []); return s.players[0].rotateCooldown; };
  const [a, b] = [cd(base), cd(withOil)];
  if (!(b < a)) throw new Error(`oil should shorten rotate cooldown: ${a} -> ${b}`);
  const withRelay = base.map((m, i) => i === 1 ? { unit: id("久米仙人") } : m);
  const s = E.newBattle(9, withRelay, base, { noItems: true });
  let relays = 0;
  for (let i = 0; i < 1200 && !s.outcome; i++) { const ev = []; E.step(s, [], ev); relays += ev.filter(e => e.t === "relay" && e.uid < 6).length; }
  if (!relays) throw new Error("relay never fired");
  console.log(`oil: rotate wait ${a} -> ${b} ticks, relay fired ${relays} times`);
}
