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

// 3. おんみつ魂：ほかの前衛がいる間はこうげきされない。ねらう指定（ピン）をされても同じ（本家どおり）
for (let seed = 1; seed <= 20; seed++) {
  const st = battle(seed, "rsoul_onmitsu");
  let hit = 0, tauntBefore = false;
  run(st, 1500, (s, ev) => {
    s.players[1].target = 0; // 相手はおんみつの妖怪をねらう
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

// 6. 閃光魂：前衛にいれば最初に動く。1 度だけ。次に動くはずだった妖怪の番はとばされ（note マグロ）、
//    敵味方の前衛の行動ポイントから 閃光の妖怪が発動したときに持っていた行動ポイントを引く（note たくトンボ）
for (let seed = 1; seed <= 10; seed++) {
  const st = battle(seed, "rsoul_senkou");
  const u = st.players[0].units[0];
  check(u.flashArmed && u.ap === 0 && !u.firstStrikeUsed, `閃光魂 seed ${seed}: not armed at start`);
  // 閃光を持つ妖怪（相手や味方のスキル・魂）どうしはすばやさ順。それ以外のだれよりも先に動く
  const armed = new Set(st.players.flatMap(p => p.units.filter(x => x.flashArmed).map(x => x.uid)));
  let first = null, skips = 0, before = null;
  const front = s => s.players.flatMap(p => p.wheel.slice(0, 3).map(i => p.units[i]));
  for (let i = 0; i < 1500 && !st.outcome; i++) {
    before = new Map(front(st).map(x => [x.uid, x.ap]));
    const ev = [];
    E.step(st, [], ev);
    for (const e of ev) {
      if (e.t === "action" && first === null && (e.uid === 0 || !armed.has(e.uid))) first = e.uid;
      if (e.t === "flashSkip" && e.uid === 0) {
        skips++;
        // とばされた妖怪のほかは、行動ポイントが増えない（引かれるだけ）
        check(e.skipped !== null, `閃光魂 seed ${seed}: 番がとばされなかった`);
        for (const x of front(st)) if (x.uid !== 0 && x.uid !== e.skipped && !ev.some(a => a.t === "action" && a.uid === x.uid) && before.has(x.uid) && x.ap > before.get(x.uid))
          check(false, `閃光魂 seed ${seed}: ${x.uid} の行動ポイントが増えた ${before.get(x.uid)} -> ${x.ap}`);
      }
    }
  }
  check(first === 0, `閃光魂 seed ${seed}: first actor ${first}`);
  check(skips === 1, `閃光魂 seed ${seed}: flashed ${skips} times`);
  check(u.firstStrikeUsed && !u.flashArmed, `閃光魂 seed ${seed}: not used up`);
}
// 後衛から前に出たとき：すぐ動き、ほかの妖怪の番がとばされる
{
  const t1 = E.randomTeam(E.seedRng(5, 1)), t2 = E.randomTeam(E.seedRng(5, 2));
  t1[3] = { ...t1[3], equipment: "rsoul_senkou" };
  const st = E.newBattle(5, t1, t2, {});
  const u = st.players[0].units[3];
  check(!u.flashArmed, "閃光魂: armed in the back row");
  let rotated = -1, acted = -1, skip = null;
  for (let i = 0; i < 1500 && !st.outcome; i++) {
    const ev = [];
    E.step(st, rotated < 0 && st.tick > 40 ? [{ player: 0, input: { t: "rotate", dir: "cw", steps: 3 } }] : [], ev);
    for (const e of ev) {
      if (e.t === "rotate" && e.player === 0 && rotated < 0) rotated = st.tick;
      if (e.t === "action" && e.uid === 3 && acted < 0) acted = st.tick;
      if (e.t === "flashSkip" && e.uid === 3) skip = e.skipped;
    }
  }
  check(rotated >= 0 && acted >= 0 && acted - rotated <= 2, `閃光魂（後衛から）: rotated ${rotated}, acted ${acted}`);
  check(skip !== null && skip !== 3, `閃光魂（後衛から）: no skip`);
}

console.log(fails.length ? "FAIL:\n" + fails.join("\n") : `rare souls ok (${rare.length})`);
if (fails.length) process.exit(1);
