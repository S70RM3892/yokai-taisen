// レア魂（持ち物）が対戦で本当に効いているかを、実際に対戦を回して確かめる。
//   node tools/build.mjs --engine-only && node tests/rare_souls.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const E = require("../dist/engine.cjs");

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };

// P1 の 1 体目（前衛のまん中ではなく wheel[0]）に持ち物を持たせて対戦を始める
function battle(seed, equipment, opts = {}) {
  const t1 = E.randomTeam(E.seedRng(seed, 1)), t2 = E.randomTeam(E.seedRng(seed, 2));
  t1[0] = { ...t1[0], equipment };
  return E.newBattle(seed, t1, t2, opts);
}
// CPU なしで n tick 進める。each(state, events) を毎 tick 呼ぶ
function run(st, n, each) {
  for (let i = 0; i < n && !st.outcome; i++) {
    const ev = [];
    E.step(st, [], ev);
    each?.(st, ev);
  }
}

// 1. 全部のレア魂に効果がのっていて、持たせると unit.fx に入る
const rare = E.equips.filter(e => e.cat === "レア魂");
check(rare.length === 27, `rare souls: ${rare.length}`);
for (const e of rare) {
  check(e.fx && Object.keys(e.fx).length > 0, `${e.name}: no fx`);
  const st = battle(1, e.id);
  const u = st.players[0].units[0];
  for (const k of Object.keys(e.fx)) check(u.fx[k], `${e.name}: fx.${k} not on the unit`);
}

let total = 0;
// 2. ちょうはつ魂：相手がほかの妖怪をねらう指定（ピン）をしていても、こうげきは持ち主に集まる（本家どおり）
for (let seed = 1; seed <= 20; seed++) {
  const st = battle(seed, "rsoul_chouhatsu");
  let toTaunt = 0, toOther = 0;
  run(st, 1500, (s, ev) => {
    const p1 = s.players[0], taunter = p1.units[0];
    s.players[1].target = p1.wheel[1]; // 前衛のほかの 1 体をねらわせる
    // 味方のよいとりつき「ちょうはつ」がついた妖怪のほうが先（とりつきで選んだ的）
    if (p1.units.some(u => u.hp > 0 && u.blessing?.kind === "taunt")) return;
    for (const e of ev) {
      if (e.t !== "damage" || e.source !== "attack" || e.dst >= 6 || e.src < 6) continue;
      if (taunter.hp <= 0 || p1.wheel.indexOf(0) >= 3) continue;
      e.dst === 0 ? toTaunt++ : toOther++;
    }
  });
  check(toOther === 0, `ちょうはつ魂 seed ${seed}: ${toOther} attacks went elsewhere (${toTaunt} to the taunter)`);
  total += toTaunt;
}
check(total >= 20, `ちょうはつ魂: only ${total} attacks reached the taunter`);

// 3. おんみつ魂：ねらう指定がなければ、ほかの前衛がいる間はこうげきされない
for (let seed = 1; seed <= 20; seed++) {
  const st = battle(seed, "rsoul_onmitsu");
  let hit = 0, tauntBefore = false;
  run(st, 1500, (s, ev) => {
    // ほかの前衛に、ねらわれる妖怪（おんみつでない・ちょうはつでない）がいる間だけ数える
    const p1 = s.players[0];
    const others = [1, 2].map(i => p1.units[p1.wheel[i]]).some(u => u.hp > 0 && !u.fx.hidden);
    // よいとりつき「ちょうはつ」は、その tick の行動の前についていたら先に攻撃を集める（行動のあと消えることがある）
    const taunt = tauntBefore || p1.units.some(u => u.hp > 0 && u.blessing?.kind === "taunt");
    tauntBefore = p1.units.some(u => u.hp > 0 && u.blessing?.kind === "taunt");
    if (taunt) return;
    for (const e of ev) if (e.t === "damage" && e.source === "attack" && e.dst === 0 && e.src >= 6 && others && s.players[0].wheel.indexOf(0) < 3) hit++;
  });
  check(hit === 0, `おんみつ魂 seed ${seed}: attacked ${hit} times`);
}

// 4. ガード魂：ガードしかしない
for (let seed = 1; seed <= 10; seed++) {
  const st = battle(seed, "rsoul_guard");
  const acts = new Set();
  run(st, 800, (s, ev) => { for (const e of ev) if (e.t === "action" && e.uid === 0) acts.add(e.action); });
  acts.delete("loaf"), acts.delete("stunned");
  check(acts.size === 0 || [...acts].every(a => a === "guard"), `ガード魂 seed ${seed}: actions ${[...acts]}`);
}

// 5. スパルタ魂：前衛にいる間、敵味方ともサボらない
for (let seed = 1; seed <= 10; seed++) {
  const st = battle(seed, "rsoul_sparta");
  let loaf = 0;
  run(st, 800, (s, ev) => {
    if (s.players[0].wheel.indexOf(0) >= 3 || s.players[0].units[0].hp <= 0) return;
    for (const e of ev) if (e.t === "action" && e.action === "loaf") loaf++;
  });
  check(loaf === 0, `スパルタ魂 seed ${seed}: ${loaf} loafs`);
}

// 6. 閃光魂：前衛にいれば最初の番がすぐ来る
{
  const st = battle(3, "rsoul_senkou");
  check(st.players[0].units[0].firstStrikeUsed && st.players[0].units[0].ap === 0, "閃光魂: not first");
}

console.log(fails.length ? "FAIL:\n" + fails.join("\n") : `rare souls ok (${rare.length})`);
if (fails.length) process.exit(1);
