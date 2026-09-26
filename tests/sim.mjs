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
  // このゲームの妖怪は 1 体ずつ別の特性。本家の妖怪は本家のスキル（同じスキルを持つ妖怪がいる）
  if (!t.honke && tNames.has(t.name)) throw new Error(`dup trait name ${t.name}`);
  if (t.honke && !Object.keys(t.fx).length) throw new Error(`honke skill without effect: ${d.name} ${t.name}`);
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
console.log(`honke yokai: ${E.units.filter(d => d.trait === "honke").length}, rare souls: ${E.equips.filter(e => e.cat === "レア魂").length}`);
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

// なめらかオイル（回転の待ちが短い）・ひとまかせ（となりの番が早まる）
{
  const id = n => E.units.find(u => u.name === n).id;
  const base = ["ヨロイさん", "むりだ城", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん"].map(n => ({ unit: id(n) }));
  const withOil = base.map((m, i) => i === 5 ? { unit: id("あせっか鬼") } : m);
  const cd = team => { const s = E.newBattle(7, team, base, { noItems: true }); E.step(s, [{ player: 0, input: { t: "rotate", dir: "cw", steps: 1 } }], []); return s.players[0].rotateCooldown; };
  const [a, b] = [cd(base), cd(withOil)];
  if (!(b < a)) throw new Error(`oil should shorten rotate cooldown: ${a} -> ${b}`);
  const withRelay = base.map((m, i) => i === 1 ? { unit: id("ひとまか仙人") } : m);
  const s = E.newBattle(9, withRelay, base, { noItems: true });
  let relays = 0;
  for (let i = 0; i < 1200 && !s.outcome; i++) { const ev = []; E.step(s, [], ev); relays += ev.filter(e => e.t === "relay" && e.uid < 6).length; }
  if (!relays) throw new Error("relay never fired");
  console.log(`oil: rotate wait ${a} -> ${b} ticks, relay fired ${relays} times`);
}

// 奥義：タッチアクションを最後まで終えないと発動しない（時間切れの自動発動なし）。速さで威力は変わらない
{
  const walls = ["ヨロイさん", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん", "むりだ城"].map(n => ({ unit: E.units.find(u => u.name === n).id }));
  const teams = [walls, walls];
  const run = (fillAt, amounts) => {
    const s = E.newBattle(3, teams[0], teams[1], { noItems: true });
    const p = s.players[0], u = p.units[p.wheel[0]];
    u.sg = 1000, u.ultLockout = 0;
    E.step(s, [{ player: 0, input: { t: "ultStart", allySlot: 0, grand: false } }], []);
    if (!p.stance) throw new Error("stance did not start");
    p.stance.game = "mawase";
    let fired = null, dmg = 0;
    for (let i = 0; i < 400 && !fired; i++) {
      const inputs = i >= fillAt ? amounts.map(a => ({ player: 0, input: { t: "ultCharge", amount: a } })) : [];
      const ev = [];
      E.step(s, inputs, ev);
      const f = ev.find(e => e.t === "ult" && e.player === 0);
      if (f) fired = { tick: s.tick, f };
      if (fired) dmg = ev.filter(e => e.t === "damage" && e.src === u.uid).reduce((a, e) => a + e.amount, 0);
    }
    return fired;
  };
  if (run(9999, [300])) throw new Error("ult fired without finishing the touch action");
  const fast = run(0, [300, 300, 300, 300]), slow = run(150, [50]);
  if (!fast || !slow) throw new Error("ult did not fire after finishing");
  if (fast.f.quality !== slow.f.quality || fast.f.charge >= slow.f.charge) throw new Error("quality should not depend on speed");
  console.log(`ult: fires only when finished (fast ${fast.f.charge} ticks / slow ${slow.f.charge} ticks, same quality "${fast.f.quality}")`);
}

// ひっさつわざの「敵全体」と「敵複数」（本家）：全体は前衛の敵それぞれに全部、複数は ○ 発を散らして当てる
{
  const fire = (name, seed) => {
    const walls = ["ヨロイさん", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん", "むりだ城"].map(n => ({ unit: E.units.find(u => u.name === n).id }));
    const me = [{ unit: E.units.find(u => u.name === name).id }, ...walls.slice(1)];
    const s = E.newBattle(seed, me, walls, { noItems: true });
    const p = s.players[0], u = p.units[p.wheel[0]];
    u.sg = 1000, u.ultLockout = 0;
    // 構えの間に相手のとりつきで解けないよう、相手は行動できなくしておく
    for (const f of s.players[1].units) f.curse = { kind: "stun", tier: 0, elapsed: 0, remaining: 1e9 };
    E.step(s, [{ player: 0, input: { t: "ultStart", allySlot: 0, grand: false } }], []);
    if (!p.stance) throw new Error(`${name}: stance did not start`);
    p.stance.game = "mawase";
    for (let i = 0; i < 50; i++) {
      const ev = [];
      E.step(s, [{ player: 0, input: { t: "ultCharge", amount: 300 } }], ev);
      if (ev.some(e => e.t === "ult")) return ev.filter(e => e.t === "damage" && e.src === u.uid && e.source === "ult");
    }
    throw new Error(`${name}: ult did not fire`);
  };
  const def = n => E.units.find(u => u.name === n).ult;
  if (!def("ぶようじん坊").spread || def("ぶようじん坊").hits !== 5 || def("ゲンマ将軍").spread) throw new Error("ult spread data wrong");
  let spreadTargets = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const d = fire("ぶようじん坊", seed); // いりょく 18 x 5 (敵複数に攻撃)
    const hits = d.reduce((a, e) => a + (e.hits ?? 1), 0);
    if (hits !== 5) throw new Error(`spread ult landed ${hits} hits, not 5`);
    spreadTargets += d.length;
  }
  const all = fire("ゲンマ将軍", 1); // いりょく 130 x 1 (敵全体に攻撃)
  if (all.length !== 3) throw new Error(`all-target ult hit ${all.length} foes`);
  console.log(`ult spread: 5 hits scattered (avg ${(spreadTargets / 20).toFixed(1)} foes), all-target hits 3`);
}

// おはらい：本家どおり、タッチアクションをしないと進まない。とりつかれた敵を攻撃すると妖気が多くたまる
{
  const s = E.newBattle(5, E.randomTeam(E.seedRng(5, 1)), E.randomTeam(E.seedRng(5, 2)), { noItems: true });
  const p = s.players[0], u = p.units[p.wheel[4]];
  u.curse = { kind: "weaken", tier: 0, elapsed: 0, remaining: 1e9 };
  E.step(s, [{ player: 0, input: { t: "purify", allySlot: 4 } }], []);
  if (!p.purify) throw new Error("purify did not start");
  for (let i = 0; i < 600; i++) E.step(s, [], []);
  if (!u.curse || !p.purify || p.purify.progress !== 0) throw new Error("purify progressed without touch action");
  for (let i = 0; i < 100 && u.curse; i++) E.step(s, [{ player: 0, input: { t: "purifyTap", amount: 50 } }], []);
  if (u.curse) throw new Error("purify taps did not clear the curse");
  const gain = { on: [0, 0], off: [0, 0] };
  for (let g = 0; g < 40; g++) {
    const seed = g * 31 + 7, lv = { perfectPermil: 0, pokeHitPermil: 0, grandPermil: 0, itemPermil: 0 };
    const st = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
    const cpus = [E.newCpu(0, seed ^ 5, lv), E.newCpu(1, seed ^ 6, lv)];
    while (!st.outcome && st.tick < 2000) {
      const inputs = [];
      for (const q of [0, 1]) for (const i of E.cpuInputs(cpus[q], st)) if (i.t !== "ultStart" && i.t !== "pokeStart") inputs.push({ player: q, input: i });
      const before = new Map(st.players.flatMap(P => P.units).map(x => [x.uid, { sg: x.sg, bad: x.loafing || x.curse !== null }]));
      const ev = [];
      E.step(st, inputs, ev);
      const a = ev.find(e => e.t === "action" && e.action === "attack"), d = a && ev.find(e => e.t === "damage" && e.src === a.uid && e.source === "attack");
      if (!d) continue;
      const x = st.players.flatMap(P => P.units).find(y => y.uid === a.uid);
      if (x.sg >= 1000) continue;
      const k = before.get(d.dst).bad ? "on" : "off";
      gain[k][0] += x.sg - before.get(a.uid).sg, gain[k][1]++;
    }
  }
  const on = gain.on[0] / gain.on[1], off = gain.off[0] / gain.off[1];
  if (!(on > off * 1.5)) throw new Error(`sg vs loafing/cursed ${on} not above normal ${off}`);
  console.log(`purify needs touch action; sg per attack: normal ${off.toFixed(0)}, vs loafing/cursed ${on.toFixed(0)}`);
}

// とりつきのルール（本家）：悪いとりつき中は奥義を撃てない・時間では消えない。ちょうはつ魂は攻撃を集める
{
  const id = n => E.units.find(u => u.name === n).id;
  const mk = names => names.map(n => ({ unit: id(n) }));
  const A = mk(["ブリー隊長", "むりだ城", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん"]);
  const B = mk(["ヨロイさん", "むりだ城", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん"]);
  const st = E.newBattle(7, A, B, { noItems: true });
  const p = st.players[0], u = p.units[p.wheel[0]];
  u.sg = 1000, u.curse = { kind: "weaken", tier: 0, remaining: 1, elapsed: 0 };
  const ev = [];
  E.step(st, [{ player: 0, input: { t: "ultStart", allySlot: 0, grand: false } }], ev);
  if (!ev.some(e => e.t === "dropped" && e.input.t === "ultStart") || p.stance) throw new Error("cursed unit must not start an ult");
  for (let i = 0; i < 600 && u.hp > 0; i++) E.step(st, [], []);
  if (u.hp > 0 && !u.curse) throw new Error("bad inspirit must stay until purified");
  // ちょうはつ魂
  const T = mk(["ブリー隊長", "むりだ城", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん"]).map((m, i) => i === 2 ? { ...m, equipment: "rsoul_chouhatsu" } : m);
  const s2 = E.newBattle(11, T, mk(["ヨロイさん", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん", "むりだ城"]), { noItems: true });
  let hitTaunt = 0, hitOther = 0;
  const holder = s2.players[0].units[2];
  for (let i = 0; i < 3000 && !s2.outcome && holder.hp > 0; i++) { // ちょうはつ魂の妖怪が倒れるまで
    const e2 = [];
    E.step(s2, [], e2);
    for (const e of e2) if (e.t === "damage" && (e.source === "attack" || e.source === "skill") && e.src >= 6 && e.dst < 6) {
      const d = s2.players[0].units[e.dst];
      d.fx.taunt || d.blessing?.kind === "taunt" ? hitTaunt++ : hitOther++; // よいとりつき「挑発」も同じく攻撃を集める
    }
  }
  if (hitTaunt < (hitTaunt + hitOther) * 0.7) throw new Error(`taunt soul did not draw attacks (${hitTaunt} / ${hitOther})`);
  console.log(`inspirit: cursed cannot ult, curse persists; taunt soul drew ${hitTaunt}/${hitTaunt + hitOther} hits`);
}

// 前衛が全滅したら、倒れる演出を待ってから（32 tick 以上）メンバーサークルが回る
{
  let checked = 0;
  for (let g = 0; g < 40 && checked < 5; g++) {
    const seed = (g * 7919 + 3) >>> 0;
    const st = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
    const cpus = [E.newCpu(0, seed ^ 5, levels[0]), E.newCpu(1, seed ^ 6, levels[0])];
    const lastKo = [-1e9, -1e9];
    while (!st.outcome) {
      const inputs = [];
      for (const p of [0, 1]) for (const input of E.cpuInputs(cpus[p], st)) if (input.t !== "rotate") inputs.push({ player: p, input });
      const ev = [];
      E.step(st, inputs, ev);
      for (const e of ev) {
        if (e.t === "ko") lastKo[e.uid < 6 ? 0 : 1] = st.tick;
        if (e.t === "forcedRotate") {
          if (st.tick - lastKo[e.player] < 32) throw new Error(`forced rotate ${st.tick - lastKo[e.player]} ticks after KO`);
          checked++;
        }
      }
    }
  }
  if (!checked) throw new Error("no forced rotate happened");
  console.log(`forced rotate waits for the KO effect (${checked} checked)`);
}

// メンバーサークルの回転は行動と同じ判定：行動のモーション中（tick < busyUntil）に回しても反映せず、
// モーションが終わって次の行動が選ばれる前に回る
{
  let queued = 0, now = 0;
  for (let g = 0; g < 20 && queued < 5; g++) {
    const seed = (g * 104729 + 11) >>> 0;
    const st = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
    const cpu = E.newCpu(1, seed ^ 9, levels[0]);
    let sent = false;
    while (!st.outcome && st.tick < 3000) {
      const p = st.players[0], inputs = [];
      for (const input of E.cpuInputs(cpu, st)) inputs.push({ player: 1, input });
      if (!sent && st.tick > 40 && p.rotateCooldown === 0 && !p.pendingRotate) inputs.push({ player: 0, input: { t: "rotate", dir: "cw", steps: 1 } }), sent = true;
      const busy = st.tick < st.busyUntil, before = p.wheel.join(), ev = [];
      E.step(st, inputs, ev);
      const rot = ev.find(e => e.t === "rotate" && e.player === 0);
      if (sent && busy && inputs.some(x => x.player === 0)) {
        if (rot || st.players[0].wheel.join() !== before) throw new Error("rotated during a motion");
        if (!st.players[0].pendingRotate) throw new Error("rotation during a motion was not queued");
        queued++;
      } else if (inputs.some(x => x.player === 0)) now++;
      if (rot && st.players[0].pendingRotate) throw new Error("pending rotation not cleared");
      if (st.players[0].pendingRotate && st.tick > st.busyUntil + 1) throw new Error("queued rotation not applied after the motion");
      if (rot) sent = false;
      if (ev.some(e => e.t === "rotateDropped" && e.player === 0)) sent = false;
    }
  }
  if (!queued) throw new Error("no rotation was queued");
  console.log(`rotate during a motion: queued ${queued}, applied at once ${now}`);
}

// 妖怪は本家の妖怪だけ（id は本家の No）。能力値 Lv60・ランク・スキルが本家どおり。赤鬼・青鬼・黒鬼はあわせて 1 体まで
{
  const by = n => E.units.find(u => u.name === n);
  const want = { ブシニャン: ["S", 272, 157, "超クリティカル"], 赤鬼: ["S", 438, 200, "ガードくずし"], 大ガマ: ["S", 270, 154, "ガマのまもり"],
    ミツマタノヅチ: ["B", 232, 132, "トリプルヘッド"], びきゃく: ["E", 200, 87, "美脚"], 天狗: ["S", 237, 90, "風あそび"] };
  if (E.units.length !== 398 || E.units.some(d => d.trait !== "honke" || !/^y\d{3}$/.test(d.id))) throw new Error("本家にない妖怪が残っている");
  for (const [n, [rank, hp, atk, skill]] of Object.entries(want)) {
    const d = by(n);
    if (d.rank !== rank || d.hp !== hp || d.atk !== atk || d.hskill !== skill || d.trait !== "honke") throw new Error(`${n} is not honke data: ${d.rank} ${d.hp} ${d.atk} ${d.hskill}`);
  }
  const oni = ["赤鬼", "黒鬼", "ブリー隊長", "肉くいおとこ", "さきがけの助", "びきゃく"].map(n => ({ unit: by(n).id }));
  if (!E.validateTeam(oni).some(s => s.includes("赤鬼・青鬼・黒鬼"))) throw new Error("赤鬼と黒鬼を同じチームに入れられてしまう");
  // 肉食オーラ（前衛）で こうげきがふえ、草食オーラでへる
  const share = name => {
    const team = [name, "ブリー隊長", "さきがけの助", "びきゃく", "びきゃく", "びきゃく"].map(n => ({ unit: by(n).id, nature: "tanki" }));
    const foe = ["シロカベ", "むりだ城", "から傘お化け", "から傘お化け", "びきゃく", "ろくろ首"].map(n => ({ unit: by(n).id, nature: "tanki" }));
    let atk = 0, all = 0;
    for (let seed = 0; seed < 30; seed++) {
      const s = E.newBattle(seed, team, foe, { noItems: true });
      for (let i = 0; i < 600 && !s.outcome; i++) { const ev = []; E.step(s, [], ev); for (const e of ev) if (e.t === "action" && e.uid >= 6 && ["attack", "skill", "guard", "curse", "bless"].includes(e.action)) { all++; e.action === "attack" && atk++; } }
    }
    return atk / all;
  };
  const [meat, grass] = [share("肉くいおとこ"), share("草くいおとこ")];
  if (!(meat > grass + 0.1)) throw new Error(`肉食オーラ ${meat} / 草食オーラ ${grass}`);
  console.log(`honke replace ok; foe attack share: 肉食オーラ ${(meat * 100).toFixed(0)}% / 草食オーラ ${(grass * 100).toFixed(0)}%`);
}
