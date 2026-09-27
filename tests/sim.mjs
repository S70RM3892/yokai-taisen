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

// なめらかオイル（回転の待ちが短い）・ひとまかせ（自分のかわりに となりの前衛の味方を行動させる。右どなり優先）
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
  const sen = s.players[0].units[1];
  for (let i = 0; i < 1200 && !s.outcome; i++) {
    const p = s.players[0], ev = [];
    E.step(s, [], ev);
    for (const [k, e] of ev.entries()) {
      if (e.t === "action" && e.uid === sen.uid && p.wheel.indexOf(sen.index) <= 2 && !["stunned", "loaf", "rest"].includes(e.action)) {
        const pos = p.wheel.indexOf(sen.index), nb = [pos + 1, pos - 1].filter(q => q >= 0 && q <= 2).map(q => p.units[p.wheel[q]]).find(u => u.hp > 0);
        if (nb) throw new Error("ひとまか仙人 acted itself with a front neighbor");
      }
      if (e.t !== "relay" || e.uid !== sen.uid) continue;
      relays++;
      // すぐ後の行動は、任された となりの味方のもの（右どなり優先）
      const next = ev.slice(k + 1).find(x => x.t === "action");
      if (!next || next.uid !== e.to) throw new Error("relay target did not act");
      // 本家：「自分のかわりにとなりの味方を攻撃させる」（ようじゅつ・とりつきではなく こうげき）
      if (next.action !== "attack" && next.action !== "loaf") throw new Error(`relay target did ${next.action}, not attack`);
      const pos = p.wheel.indexOf(sen.index), right = pos < 2 ? p.units[p.wheel[pos + 1]] : null;
      if (right && right.hp > 0 && e.to !== right.uid) throw new Error("relay should prefer the right neighbor");
    }
  }
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
    for (let i = 0; i < 200; i++) {
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

// 復活のひっさつわざ（本家）：前衛の味方だけ。花さか爺・心オバアは復活＋前衛全員 HP 全回復、おでんじんは 1 体だけ
{
  const fire = (name, seed) => {
    const walls = ["ヨロイさん", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん", "むりだ城"].map(n => ({ unit: E.units.find(u => u.name === n).id }));
    const me = [{ unit: E.units.find(u => u.name === name).id }, ...walls.slice(1)];
    const s = E.newBattle(seed, me, walls, { noItems: true });
    const p = s.players[0], u = p.units[p.wheel[0]];
    const front = [1, 2].map(i => p.units[p.wheel[i]]), back = [3, 4].map(i => p.units[p.wheel[i]]);
    front[0].hp = 0, back[0].hp = 0, back[1].hp = 0; // 前衛 1 体・後衛 2 体が気絶
    front[1].hp = 1; // 前衛のもう 1 体は HP が減っている
    u.sg = 1000, u.ultLockout = 0;
    for (const f of s.players[1].units) f.curse = { kind: "stun", tier: 0, elapsed: 0, remaining: 1e9 };
    E.step(s, [{ player: 0, input: { t: "ultStart", allySlot: 0, grand: false } }], []);
    if (!p.stance) throw new Error(`${name}: stance did not start`);
    p.stance.game = "mawase";
    for (let i = 0; i < 200; i++) {
      const ev = [];
      E.step(s, [{ player: 0, input: { t: "ultCharge", amount: 300 } }], ev);
      if (ev.some(e => e.t === "ult")) return { front, back };
    }
    throw new Error(`${name}: ult did not fire`);
  };
  for (const name of ["花さか爺", "心オバア"]) {
    const { front, back } = fire(name, 1);
    if (front[0].hp !== front[0].maxHp) throw new Error(`${name}: front ally revived with ${front[0].hp}/${front[0].maxHp}`);
    if (front[1].hp !== front[1].maxHp) throw new Error(`${name}: front ally not fully healed (${front[1].hp}/${front[1].maxHp})`);
    if (back.some(b => b.hp > 0)) throw new Error(`${name}: back-row ally revived`);
  }
  {
    const { front, back } = fire("おでんじん", 1);
    if (front[0].hp <= 0 || front[0].hp === front[0].maxHp) throw new Error(`おでんじん: front ally ${front[0].hp}/${front[0].maxHp}`);
    if (front[1].hp !== 1) throw new Error("おでんじん: healed a living ally");
    if (back.some(b => b.hp > 0)) throw new Error("おでんじん: back-row ally revived");
  }
  console.log("revive ult: front row only (花さか爺・心オバア full HP, おでんじん one ally)");
}

// とりつき（本家）：「ちからアップ」はちからだけ・「ようりょくアップ」はようりょくだけ。上がる量は 通常 10%・大 15%・超 25%。
// ガード中は とりつかれやすさが半分
{
  const bless = (name) => {
    const d = E.units.find(u => u.name === name);
    const walls = ["ヨロイさん", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん", "むりだ城"].map(n => ({ unit: E.units.find(u => u.name === n).id }));
    const s = E.newBattle(1, [{ unit: d.id }, ...walls.slice(1)], walls, { noItems: true });
    const p = s.players[0], me = p.units[0], ally = p.units[1];
    const before = { atk: E.statOf(p, ally, "atk"), spa: E.statOf(p, ally, "spa") };
    ally.blessing = null;
    E.blessUnit([], me, ally, d.blessing, d.inspTier, d.inspStat);
    return { d, before, after: { atk: E.statOf(p, ally, "atk"), spa: E.statOf(p, ally, "spa") }, base: { atk: ally.atk, spa: ally.spa } };
  };
  const a = bless("ちからモチ"); // ちからアップ
  if (a.d.inspStat !== "atk") throw new Error("ちからモチ: inspStat");
  if (a.after.spa !== a.before.spa || a.after.atk !== Math.floor(a.base.atk * 1100 / 1000)) throw new Error(`ちからアップ: ${JSON.stringify(a)}`);
  const b = bless("えんらえんら"); // ようりょくアップ
  if (b.after.atk !== b.before.atk || b.after.spa <= b.before.spa) throw new Error(`ようりょくアップ: ${JSON.stringify(b)}`);
  console.log("inspirit: ちからアップ raises only ちから (+10%), ようりょくアップ only ようりょく");
}

// サドンデス（本家）：ダメージはぜんぶ 999、こうげきしかしない・ひっさつわざも使えない
{
  const s = E.newBattle(4, E.randomTeam(E.seedRng(4, 1)), E.randomTeam(E.seedRng(4, 2)), { noItems: true });
  s.tick = 5999; // すぐサドンデスにする
  const acts = new Set();
  for (let i = 0; i < 400 && !s.outcome; i++) {
    const p = s.players[0], u = p.units[p.wheel[0]];
    u.sg = 1000, u.ultLockout = 0, u.curse = null;
    const ev = [];
    E.step(s, [{ player: 0, input: { t: "ultStart", allySlot: 0, grand: false } }], ev);
    if (p.stance) throw new Error("ult started during sudden death");
    for (const e of ev) if (e.t === "action" && s.tick > 6000) acts.add(e.action); // 最初の 1 tick（5999）はまだサドンデス前
  }
  for (const a of acts) if (!["attack", "loaf", "stunned", "rest"].includes(a)) throw new Error(`sudden death action: ${a}`);
  console.log(`sudden death: attack only (${[...acts].join(",")}), no ult`);
}

// 毒（ダメージのとりつき）と回復のとりつきは、時間ではなく だれかが 1 回行動するたびに 1 回だけはたらく
{
  const seed = 11;
  const s = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
  const p = s.players[0], sick = p.units[p.wheel[0]], well = p.units[p.wheel[1]];
  let steps = 0, acted = 0, poisonHits = 0, regenHeals = 0;
  while (!s.outcome && steps < 2000) {
    // 毎 tick 状態を作り直す（気絶・上書き・時間切れで条件が変わらないように）
    sick.hp = sick.maxHp, sick.curse = { kind: "poison", tier: 0, elapsed: 0, remaining: 1e9 };
    well.hp = 1 + (well.maxHp >> 1), well.blessing = { kind: "regen", tier: 0, turns: 1e9, fresh: false, elapsed: 0, wardCharges: 0, stat: null };
    if (p.wheel.indexOf(sick.index) >= 3 || p.wheel.indexOf(well.index) >= 3) break;
    const ev = [];
    E.step(s, [], ev);
    steps++;
    const a = ev.filter(e => e.t === "action").length;
    const ph = ev.filter(e => e.t === "damage" && e.source === "poison" && e.dst === sick.uid).length;
    const rh = ev.filter(e => e.t === "heal" && e.src === null && e.dst === well.uid).length;
    // 同じ行動のようじゅつで HP が満タンになったときは、回復のとりつきの回復は出ない
    const rhOk = rh === (a ? 1 : 0) || (a && rh === 0 && well.hp === well.maxHp);
    if (ph !== (a ? 1 : 0) || !rhOk) throw new Error(`tick ${s.tick}: actions ${a}, poison ${ph}, regen ${rh}`);
    acted += a ? 1 : 0, poisonHits += ph, regenHeals += rh;
  }
  if (acted < 5) throw new Error(`too few actions to check poison/regen (${acted})`);
  console.log(`poison/regen: once per action (${acted} actions in ${steps} ticks, poison ${poisonHits}, regen ${regenHeals})`);
}

// ひっさつわざ（本家）：だれかのモーション中にチャージが終わったら、モーションが終わってから撃つ。
// 当たるのは チャージが終わったときに相手が出していた面（カウンター・ノーモーション）
{
  const walls = ["ヨロイさん", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん", "むりだ城"].map(n => ({ unit: E.units.find(u => u.name === n).id }));
  const me = [{ unit: E.units.find(u => u.name === "ゲンマ将軍").id }, ...walls.slice(1)]; // 敵全体に攻撃
  const s = E.newBattle(2, me, walls, { noItems: true });
  const p = s.players[0], f = s.players[1], u = p.units[p.wheel[0]];
  u.sg = 1000, u.ultLockout = 0;
  for (const x of f.units) x.curse = { kind: "stun", tier: 0, elapsed: 0, remaining: 1e9 };
  E.step(s, [{ player: 0, input: { t: "ultStart", allySlot: 0, grand: false } }], []);
  p.stance.game = "mawase";
  s.busyUntil = s.tick + 40; // だれかのモーション中
  const busyEnd = s.busyUntil;
  const face = f.wheel.slice(0, 3).map(i => f.units[i].uid);
  let firedAt = null, hit = [];
  for (let i = 0; i < 200 && firedAt === null; i++) {
    const ev = [];
    E.step(s, i < 5 ? [{ player: 0, input: { t: "ultCharge", amount: 300 } }] : [], ev);
    // チャージが終わったあとに相手がメンバーサークルを回した（前衛が総入れかえ）
    if (i === 6) f.wheel = [...f.wheel.slice(3), ...f.wheel.slice(0, 3)];
    const ul = ev.find(e => e.t === "ult");
    if (ul) firedAt = ul.tick ?? s.tick - 1, hit = ev.filter(e => e.t === "damage" && e.src === u.uid).map(e => e.dst);
  }
  if (firedAt === null) throw new Error("ult did not fire after the motion");
  if (firedAt < busyEnd) throw new Error(`ult fired during a motion (${firedAt} < ${busyEnd})`);
  if (!hit.length || hit.some(d => !face.includes(d))) throw new Error(`ult hit ${hit} not the face at completion ${face}`);
  if (f.wheel.slice(3).map(i => f.units[i].uid).join() !== face.join()) throw new Error("foe wheel was not restored after the ult");
  console.log(`ult: waits for the motion (fired at ${firedAt}, motion ended ${busyEnd}), hits the face at completion (${hit.length} foes)`);
}

// えんら魂（本家）：となりの 2 体ぶん重なる。1 つにつき その妖怪の妖気の上限の 2%／ターン（上限 1000 のこのゲームでは どの妖怪にも +20）
{
  const id = n => ({ unit: E.units.find(u => u.name === n).id });
  const rateWith = (name, enra) => {
    const t = [id(name), id("ヨロイさん"), id("ムリカベ"), id("トオセンボン"), id("ふじのやま"), id("すもうどん")];
    // メンバーサークルでとなり合うのは wheel の前後（前衛 1 番目のとなりは 2 番目と後衛の最後）
    if (enra >= 1) t[1] = { ...t[1], equipment: "soul:" + E.units.find(u => u.name === "えんらえんら").id };
    if (enra >= 2) t[5] = { ...t[5], equipment: "soul:" + E.units.find(u => u.name === "えんらえんら").id };
    const s = E.newBattle(1, t, t, { noItems: true });
    const p = s.players[0];
    return E.sgRate(p, p.units[0]);
  };
  const res = {};
  for (const n of ["ブシニャン", "のっぺら坊", "トホホギス"]) res[n] = [0, 1, 2].map(k => rateWith(n, k));
  const [b0, b1, b2] = res["ブシニャン"], [n0, n1] = res["のっぺら坊"], [f0, f1] = res["トホホギス"];
  if (!(b1 > b0 && b2 > b1)) throw new Error(`enra does not stack: ${JSON.stringify(res)}`);
  if (Math.abs(b1 - n0) > 3 || Math.abs(n1 - f0) > 4 || Math.abs(b2 - f0) > 4) throw new Error(`enra amounts off: ${JSON.stringify(res)}`);
  if (f1 - f0 !== 20 || b1 - b0 !== 20) throw new Error(`enra should add the same amount (+20) to every yokai: ${JSON.stringify(res)}`);
  console.log(`enra soul: ${JSON.stringify(res)}`);
}

// おはらい完了（本家）：お互いの隣接回復魂が 1 回はたらき、おはらい完了のモーションが出る
{
  const id = n => ({ unit: E.units.find(u => u.name === n).id });
  const pray = "soul:" + E.units.find(u => u.name === "ババァーン").id; // となりの妖怪の HP を回復する魂
  const t = [id("ヨロイさん"), { ...id("ムリカベ"), equipment: pray }, id("トオセンボン"), id("ふじのやま"), id("すもうどん"), id("むりだ城")];
  const s = E.newBattle(6, t, t, { noItems: true });
  for (const p of s.players) p.units[0].hp = 1;
  const p = s.players[0], back = p.units[p.wheel[4]];
  back.curse = { kind: "stun", tier: 0, elapsed: 0, remaining: 1e9 };
  s.busyUntil = s.tick + 1000; // だれも行動しない（行動のときの回復とまざらないように）
  E.step(s, [{ player: 0, input: { t: "purify", allySlot: 4 } }], []);
  if (!p.purify) throw new Error("purify did not start");
  let ev = [], busyBefore = 0;
  for (let i = 0; i < 200 && back.curse; i++) { ev = []; busyBefore = s.busyUntil; E.step(s, [{ player: 0, input: { t: "purifyTap", amount: 100 } }], ev); }
  if (back.curse) throw new Error("purify did not finish");
  const heals = ev.filter(e => e.t === "heal" && (e.dst === s.players[0].units[0].uid || e.dst === s.players[1].units[0].uid));
  if (heals.length !== 2) throw new Error(`purify: adjacent heal souls fired ${heals.length} times (want 2: both sides)`);
  if (s.busyUntil - busyBefore !== 48) throw new Error(`purify: no completion motion (${busyBefore} -> ${s.busyUntil})`);
  console.log("purify done: both sides' adjacent heal souls fire once, completion motion 48 ticks");
}

// 行動すると、その妖怪の妖気が少したまる（本家）：ガード・とりつきでも、前衛みんなのぶんより多くたまる
{
  let checked = 0;
  for (let g = 0; g < 10 && checked < 30; g++) {
    const seed = (g * 31337 + 7) >>> 0;
    const st = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
    while (!st.outcome && st.tick < 3000 && checked < 30) {
      const before = new Map(), rate = new Map();
      for (const p of st.players) for (const u of p.units) before.set(u.uid, u.sg), rate.set(u.uid, E.sgRate(p, u));
      const ev = [];
      E.step(st, [], ev);
      const a = ev.find(e => e.t === "action" && ["guard", "curse", "bless"].includes(e.action));
      if (!a || ev.some(e => e.t === "relay" || e.t === "ult")) continue;
      const u = st.players[a.uid < 6 ? 0 : 1].units[a.uid % 6];
      if (u.sg >= 1000 || rate.get(u.uid) === 0) continue;
      const got = u.sg - before.get(u.uid);
      if (got <= rate.get(u.uid)) throw new Error(`${a.action}: actor sg +${got}, rate ${rate.get(u.uid)}`);
      checked++;
    }
  }
  if (checked < 10) throw new Error(`too few guard/curse/bless actions (${checked})`);
  console.log(`action sg: guard/curse/bless give the actor extra sg (${checked} checked)`);
}

// 性格の決まった行動（本家）：動じないは相手がパワーチャージ中なら必ずガード、けんしん的は よいとりつきのない前衛の味方がいれば必ず味方にとりつく、
// 荒くれ・ずのう的は ピンをした相手を確実に倒せるなら必ずこうげき／ようじゅつ
{
  const id = n => ({ unit: E.units.find(u => u.name === n).id });
  const run = (setup, check, n = 1500) => {
    let seen = 0;
    for (let g = 0; g < 6 && seen < 8; g++) {
      const seed = (g * 9973 + 3) >>> 0;
      const st = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
      const u = setup(st);
      for (let i = 0; i < n && !st.outcome && seen < 8; i++) {
        const pre = check.pre?.(st, u);
        const ev = [];
        E.step(st, check.inputs?.(st, u) ?? [], ev);
        const a = ev.find(e => e.t === "action" && e.uid === u.uid);
        if (!a || ["loaf", "stunned", "rest"].includes(a.action) || ev.some(e => e.t === "relay") || pre === false) continue;
        check.test(a, st, u);
        seen++;
      }
    }
    return seen;
  };
  // 動じない：相手（player 1）の前衛がずっとパワーチャージしている
  const g1 = run(st => { const p = st.players[0], u = p.units[p.wheel[0]]; u.nature = "doujinai"; u.fx = { ...u.fx, guardOnly: 0 }; return u; }, {
    pre: st => { const f = st.players[1]; if (!f.stance) { const c = f.units[f.wheel[0]]; if (c.hp > 0) c.sg = 1000, c.curse = null, c.ultLockout = 0; } return !!f.stance; },
    inputs: st => st.players[1].stance ? [] : [{ player: 1, input: { t: "ultStart", allySlot: 0, grand: false } }],
    test: a => { if (a.action !== "guard") throw new Error(`動じない: 相手がチャージ中なのに ${a.action}`); },
  });
  // けんしん的：味方にとりつく妖怪（よいとりつき）で、前衛の味方によいとりつきがない
  const blesser = E.units.find(d => d.inspKind === "bless" && d.name === "ばか頭巾") ?? E.units.find(d => d.inspKind === "bless");
  const g2 = run(st => { const p = st.players[0], u = p.units[p.wheel[0]]; u.nature = "kenshinteki"; u.defIndex = E.units.indexOf(blesser); return u; }, {
    pre: st => st.players[0].wheel.slice(0, 3).map(i => st.players[0].units[i]).filter(x => x.hp > 0).some(x => x.blessing === null),
    test: a => { if (a.action !== "bless") throw new Error(`けんしん的: よいとりつきのない味方がいるのに ${a.action}`); },
  });
  // 荒くれ：ピンをした相手の HP が 1（確実に倒せる）
  const g3 = run(st => { const p = st.players[0], u = p.units[p.wheel[0]]; u.nature = "arakure"; return u; }, {
    pre: st => { const p = st.players[0], f = st.players[1], t = f.units[f.wheel[1]]; if (t.hp <= 0) return false; t.hp = 1; p.target = t.index; for (const x of f.units) x.blessing = null, x.fx = { ...x.fx, taunt: 0, hidden: 0 }; return true; },
    test: a => { if (a.action !== "attack") throw new Error(`荒くれ: 倒せる相手にピンをしているのに ${a.action}`); },
  });
  if (g1 < 3 || g2 < 3 || g3 < 3) throw new Error(`nature rules: too few checks ${g1}/${g2}/${g3}`);
  console.log(`nature rules: 動じない guard ${g1}, けんしん的 bless ${g2}, 荒くれ one-shot attack ${g3}`);
}

// ブロッカー（本家）：前に出るときガードする。ただし後衛へ下がってから だれも行動しないうちに戻ったときはガードしない
{
  const ids = ["ムリカベ", "ヨロイさん", "トオセンボン", "ふじのやま", "すもうどん", "むりだ城"].map(n => ({ unit: E.units.find(u => u.name === n).id }));
  const s = E.newBattle(3, ids, ids, { noItems: true });
  const p = s.players[0], wall = p.units[0]; // ムリカベ（ブロッカー）は前衛の 1 体目
  for (const q of s.players) for (const u of q.units) u.curse = { kind: "stun", tier: 0, elapsed: 0, remaining: 1e9 };
  const rot = dir => { s.busyUntil = s.tick, p.rotateCooldown = 0, p.pendingRotate = null; E.step(s, [{ player: 0, input: { t: "rotate", dir, steps: 3 } }], []); };
  // 1. 下がって、1 回でも行動があってから戻る → ガードする（回した tick に だれかが動く）
  rot("cw");
  if (p.wheel.indexOf(0) < 3 || !(p.acts >= 1)) throw new Error("blocker did not go back / nobody acted");
  rot("ccw");
  if (p.wheel.indexOf(0) >= 3) throw new Error("blocker did not come back");
  if (!wall.guarding) throw new Error("blocker did not guard after a turn passed");
  // 2. 下がって、だれも行動しないうちに戻る → ガードしない（行動の回数を下がったときの値にもどして作る）
  wall.guarding = false;
  rot("cw");
  p.acts = wall.leftAt;
  rot("ccw");
  if (wall.guarding) throw new Error("blocker guarded without a turn passing");
  console.log("blocker: guards only when a turn passed while it was in the back");
}

// つつく：ツボは妖怪ごとに決まった場所で動かない。人の速さ（1 秒に 5 回・ツボに当たるのは 7 割）でも間に合う。
// 効果は本家どおり「妖気を吸収」（相手の妖気をぜんぶ）・「HPダメージ」・まれに「一撃（999）」
{
  let ok = 0, n = 0;
  const effects = {};
  for (let seed = 1; seed <= 20; seed++) {
    const s = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
    const p = s.players[0], foe = s.players[1], f = foe.units[foe.wheel[0]];
    // だれも動かないようにして、つつくだけを見る
    for (const q of s.players) for (const u of q.units) u.curse = { kind: "stun", tier: 0, elapsed: 0, remaining: 1e9 };
    E.step(s, [{ player: 0, input: { t: "pokeStart", enemyUnit: f.index } }], []);
    if (!p.poke) throw new Error("poke did not start");
    const want = seed % 2 ? "sg" : "hp", spot = p.poke.spots[want];
    if (p.poke.spots.sg === p.poke.spots.hp) throw new Error("poke spots overlap");
    f.sg = 800;
    let result = null, end = null;
    for (let i = 0; i < 400 && !result; i++) {
      if (p.poke && p.poke.spots[want] !== spot) throw new Error("poke spot moved");
      const tap = i % 4 === 0 ? [{ player: 0, input: { t: "pokeTap", cell: (i / 4) % 10 < 7 ? spot : (spot + 1) % 16 } }] : [];
      const ev = [];
      E.step(s, tap, ev);
      for (const e of ev) if (e.t === "pokeEnd" && e.player === 0) result = e.result, end = e;
    }
    n++, result === "success" && ok++;
    if (end?.effect) {
      effects[end.effect] = (effects[end.effect] ?? 0) + 1;
      if (end.effect === "ko") throw new Error("poke: 一撃（999）は出ないはず");
      if (end.effect !== want) throw new Error(`poke: aimed ${want}, got ${end.effect}`);
      if (end.effect === "sg" && (f.sg !== 0 || end.amount < 800)) throw new Error(`poke sg: foe sg ${f.sg}, took ${end.amount}`);
    }
  }
  if (ok !== n) throw new Error(`poke at human speed: ${ok}/${n} succeeded`);
  console.log(`poke: spots stay put, human-speed tapping succeeds ${ok}/${n}, effects ${JSON.stringify(effects)}`);
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
  // 悪いとりつきは、まだとりつかれていない前衛をねらう（もうとりつかれている妖怪に上書きしない）
  let fresh = 0, again = 0;
  for (let g = 0; g < 60; g++) {
    const seed = g * 97 + 3;
    const s3 = E.newBattle(seed, E.randomTeam(E.seedRng(seed, 1)), E.randomTeam(E.seedRng(seed, 2)), { noItems: true });
    for (let i = 0; i < 1500 && !s3.outcome; i++) {
      const cursed = new Set(s3.players.flatMap(P => P.units).filter(x => x.curse).map(x => x.uid));
      const e3 = [];
      E.step(s3, [], e3);
      for (const a of e3) if (a.t === "action" && a.action === "curse") {
        const d = s3.players.flatMap(P => P.units).find(x => x.uid === a.dst);
        if (d.fx.taunt || d.blessing?.kind === "taunt") continue;
        cursed.has(a.dst) ? again++ : fresh++;
      }
    }
  }
  if (!fresh || again) throw new Error(`curse went to an already cursed unit (${again} / ${fresh + again})`);
  console.log(`inspirit: cursed cannot ult, curse persists; taunt soul drew ${hitTaunt}/${hitTaunt + hitOther} hits; curse picks uncursed foes ${fresh}/${fresh + again}`);
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

// このゲームだけの調整：超クリティカルは威力 +75%（山吹鬼もほかの妖怪も）、いのちとりの魂はクリティカル率 30%
{
  const id = n => E.units.find(u => u.name === n).id;
  const soul = "soul:" + id("いのちとり");
  const team = ["山吹鬼", "ブシニャン", "ムリカベ", "トオセンボン", "ふじのやま", "すもうどん"].map((n, i) => ({ unit: id(n), equipment: i === 1 ? soul : null }));
  const s = E.newBattle(1, team, team, { noItems: true });
  const [yama, bushi] = s.players[0].units;
  if (yama.fx.critDmg !== 750) throw new Error(`山吹鬼 critDmg ${yama.fx.critDmg}`);
  if (bushi.fx.critDmg !== 750) throw new Error(`ブシニャン critDmg ${bushi.fx.critDmg}`);
  if (bushi.fx.critEye !== 19 || !E.equipById(soul).desc.includes("30%")) throw new Error(`いのちとりの魂 ${bushi.fx.critEye}`);
  console.log(`tune: 超クリティカル crit +${yama.fx.critDmg / 10}% (山吹鬼・ブシニャン), いのちとりの魂 crit ${Math.round(bushi.fx.critEye * 100 / 64)}%`);
}
