// 本家の妖怪 398 体の組み合わせから強い編成を探し、上位 100 組を総当たりさせて勝率順に並べる。
//   node tools/build.mjs --engine-only && node tools/top100.mjs [--gens 40] [--pop 200] [--final 100] [--per 4] [--seed 1]
// 6 体の組み合わせは C(398,6) ≒ 5×10^12 通りあって全部は戦わせられないので、
//   1. 遺伝的アルゴリズムで探す（流行りの型・メタ候補とランダムな編成から始め、入れかえ・持ち物・性格・並びを変えて、
//      流行りの型・メタ候補・その時点の上位と戦わせた勝率で残す）
//   2. 見つかった編成から 2 体以上ちがうものだけを選び、同じ相手（流行りの型・メタ候補・最後の上位）と戦わせて 100 組にしぼる
//   3. 100 組を総当たり（1 組 per×2 戦・左右入れかえ）させて勝率順に並べる
// 戦うのは meta_sim.mjs と同じ いちばん強い CPU（アイテムなし＝対人戦と同じ）。結果は docs/TOP100.md と tools/top100_result.json。
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { availableParallelism } from "node:os";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = require(join(root, "dist", "engine.cjs"));
const smart = { perfectPermil: 1000, pokeHitPermil: 950, grandPermil: 1000, smart: true, itemPermil: 0 };

const toMembers = t => t.map(([unit, nature, eq, eq2]) => {
  const m = { unit, nature, diligence: "choumajime" };
  if (eq) m.equipment = eq;
  if (eq2) m.equipment2 = eq2;
  return m;
});
function play(a, b, seed) {
  const st = E.newBattle(seed, toMembers(a), toMembers(b), { noItems: true });
  const cpus = [E.newCpu(0, seed ^ 11, smart), E.newCpu(1, seed ^ 22, smart)];
  for (let g = 0; !st.outcome && g < 30000; g++) {
    const inputs = [];
    for (const p of [0, 1]) for (const input of E.cpuInputs(cpus[p], st)) inputs.push({ player: p, input });
    E.step(st, inputs, []);
  }
  return st.outcome?.winner ?? null;
}

if (!isMainThread) {
  parentPort.on("message", ({ id, jobs }) => parentPort.postMessage({ id, res: jobs.map(([a, b, s]) => play(a, b, s)) }));
} else {
  await main();
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? Number(args[i + 1]) : d; };
  const GENS = opt("gens", 40), POP = opt("pop", 200), FINAL = opt("final", 100), PER = opt("per", 4), SEED = opt("seed", 1);
  const ELITE = Math.round(POP * 0.2), OPP = 8;
  let rs = (SEED * 2654435761) >>> 0;
  const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];

  // ---- 戦わせる係（worker） ----
  const nW = Math.max(1, availableParallelism());
  const workers = Array.from({ length: nW }, () => new Worker(fileURLToPath(import.meta.url)));
  let jobId = 0;
  const pending = new Map();
  for (const w of workers) w.on("message", ({ id, res }) => { pending.get(id)(res); pending.delete(id); });
  async function runAll(jobs) {
    const out = new Array(jobs.length), chunk = 8, idle = [...workers];
    let next = 0;
    await new Promise(done => {
      let running = 0;
      const pump = () => {
        while (idle.length && next < jobs.length) {
          const w = idle.pop(), from = next, part = jobs.slice(from, from + chunk), id = jobId++;
          next += part.length, running++;
          pending.set(id, res => { res.forEach((r, k) => out[from + k] = r); idle.push(w); running--; pump(); });
          w.postMessage({ id, jobs: part });
        }
        if (!running && next >= jobs.length) done();
      };
      pump();
    });
    return out;
  }

  // ---- 遺伝子：[妖怪 id, 性格, そうび 1, そうび 2] × 6（前 3 体が前衛） ----
  const byName = n => E.units.find(x => x.name === n);
  const def = id => E.units.find(x => x.id === id);
  const soul = n => "soul:" + byName(n).id;
  const strongEq = ["densetsu_udewa", "kishin_udewa", "densetsu_yubiwa", "kishin_yubiwa", "teppeki_omamori", "densetsu_omamori", "kishin_omamori",
    "densetsu_badge", "kishin_badge", "jugon_katana", "jugon_tsue", "jugon_tate",
    ...E.equips.filter(e => e.cat === "レア魂").map(e => e.id),
    ...["ルビーニャン", "サファイニャン", "エメラルニャン", "トパーニャン", "ダイヤニャン", "えんらえんら", "メゾン・ドワスレ", "フユニャン", "ミカンニャン", "アライ魔将"].filter(byName).map(soul)];
  const allSouls = E.units.filter(d => E.equipById("soul:" + d.id)).map(d => "soul:" + d.id);
  function randEq(d) {
    const r = rnd();
    if (r < 0.7) { for (let k = 0; k < 20; k++) { const e = pick(strongEq); if (E.equipAllowed(d, e)) return e; } }
    if (r < 0.85) return pick(allSouls);
    const list = E.equipChoices(d).filter(e => !e.special?.allMult && !e.special?.noBattleEffect);
    return pick(list).id;
  }
  const NAT = ["tanki", "arakure", "reisei", "zunouteki", "yasashii", "nasakebukai", "iyarashii", "hidou", "kyouryokuteki", "kenshinteki", "shinchou", "doujinai"];
  const randNat = d => rnd() < 0.6 ? pick(d.atk >= d.spa ? ["arakure", "doujinai", "kyouryokuteki"] : ["zunouteki", "doujinai", "kyouryokuteki"]) : pick(NAT);
  const gene = d => [d.id, randNat(d), randEq(d), E.equipSlots(d) === 2 ? randEq(d) : null];
  const valid = t => E.validateTeam(toMembers(t)).length === 0;
  const key = t => JSON.stringify(t);
  const unitSet = t => t.map(g => g[0]).sort();

  // 条件（S・A は 2 体まで・グループの上限）を満たすように、はみ出した妖怪を入れかえる
  function repair(t) {
    for (let k = 0; k < 60 && !valid(t); k++) t[Math.floor(rnd() * 6)] = gene(pick(E.units));
    return valid(t) ? t : null;
  }
  function randomTeam() {
    const t = E.randomTeam(E.seedRng(Math.floor(rnd() * 1e9), 1)).map(m => gene(def(m.unit)));
    return repair(t);
  }
  function mutate(t0) {
    const t = t0.map(g => [...g]);
    const n = 1 + (rnd() < 0.4) + (rnd() < 0.15);
    for (let k = 0; k < n; k++) {
      const i = Math.floor(rnd() * 6), r = rnd(), d = def(t[i][0]);
      if (r < 0.35) t[i] = gene(pick(E.units));
      else if (r < 0.6) t[i][2] = randEq(d);
      else if (r < 0.7) { if (E.equipSlots(d) === 2) t[i][3] = randEq(d); else t[i][2] = randEq(d); }
      else if (r < 0.82) t[i][1] = randNat(d);
      else { const j = Math.floor(rnd() * 6); [t[i], t[j]] = [t[j], t[i]]; }
    }
    return repair(t);
  }
  function cross(a, b) {
    const t = a.map((g, i) => [...(rnd() < 0.5 ? g : b[i])]);
    return repair(t);
  }

  // ---- 流行りの型・メタ候補 ----
  const src = readFileSync(join(root, "src", "ext", "presets.js"), "utf8");
  const grab = name => {
    const i = src.indexOf(`var ${name} = [`);
    let d = 0, j = src.indexOf("[", i);
    for (let k = j; k < src.length; k++) { if (src[k] === "[") d++; else if (src[k] === "]" && --d === 0) return Function(`return ${src.slice(j, k + 1)}`)(); }
  };
  const ref = e => e?.startsWith("soul:") ? soul(e.slice(5)) : (e ?? null);
  const presets = [...grab("PRESETS"), ...grab("META_PRESETS")].map(p => ({ name: p.name, t: p.team.map(([n, nat, e1, e2]) => [byName(n).id, nat, ref(e1), ref(e2)]) }));
  for (const p of presets) if (!valid(p.t)) throw new Error(`preset NG ${p.name}`);

  // ---- 探す ----
  const archive = new Map(); // key → { t, w, n, gen }
  const rec = (t, gen) => { const k = key(t); if (!archive.has(k)) archive.set(k, { t, w: 0, n: 0, gen }); return archive.get(k); };
  const score = a => (a.w + 1) / (a.n + 2);
  let pop = presets.map(p => p.t);
  while (pop.length < POP) { const t = randomTeam(); if (t) pop.push(t); }
  let seedN = SEED * 1000003;
  const t0 = Date.now();
  let elites = [];
  for (let gen = 0; gen < GENS; gen++) {
    const opps = [...presets.map(p => p.t), ...elites.slice(0, 24)];
    const jobs = [], who = [];
    pop.forEach((t, i) => {
      for (let k = 0; k < OPP; k++) {
        const o = pick(opps), s = (seedN++ * 2654435761) >>> 0;
        jobs.push([t, o, s]), who.push([i, 0]);
        jobs.push([o, t, s ^ 0x5bd1e995]), who.push([i, 1]);
      }
    });
    const res = await runAll(jobs);
    const gw = pop.map(() => ({ w: 0, n: 0 }));
    res.forEach((r, k) => { const [i, side] = who[k]; gw[i].n++; if (r === side) gw[i].w++; else if (r === null) gw[i].w += 0.5; });
    pop.forEach((t, i) => { const a = rec(t, gen); a.w += gw[i].w, a.n += gw[i].n, a.last = gen; });
    // その世代の勝率（累積）で並べ、上位を残して子を作る
    const ranked = [...new Set(pop.map(key))].map(k => archive.get(k)).sort((x, y) => score(y) - score(x));
    elites = ranked.map(a => a.t);
    const keep = elites.slice(0, ELITE);
    const next = [...keep], seen = new Set(keep.map(key));
    const tour = () => { let b = null; for (let k = 0; k < 3; k++) { const c = ranked[Math.floor(rnd() * Math.min(ranked.length, POP / 2))]; if (!b || score(c) > score(b)) b = c; } return b.t; };
    let guard = 0;
    while (next.length < POP && guard++ < POP * 50) {
      const r = rnd();
      let c = r < 0.3 ? cross(tour(), tour()) : r < 0.9 ? mutate(tour()) : randomTeam();
      if (c && r < 0.3 && rnd() < 0.5) c = mutate(c);
      if (!c || seen.has(key(c))) continue;
      seen.add(key(c)), next.push(c);
    }
    pop = next;
    const top = ranked[0];
    console.log(`gen ${gen + 1}/${GENS}  ${((Date.now() - t0) / 1000).toFixed(0)} s  best ${(score(top) * 100).toFixed(0)}% (${top.n} 戦) ${top.t.map(g => def(g[0]).name).join("・")}`);
  }

  // ---- 100 組にしぼる：2 体以上ちがう編成だけ、同じ相手と戦わせる ----
  const cands = [...archive.values()].filter(a => a.n >= 32).sort((x, y) => score(y) - score(x));
  const chosen = [];
  const overlap = (a, b) => { const s = [...b]; let n = 0; for (const u of a) { const i = s.indexOf(u); if (i >= 0) n++, s.splice(i, 1); } return n; };
  for (const a of cands) {
    if (chosen.length >= FINAL * 3) break;
    const u = unitSet(a.t);
    if (chosen.some(c => overlap(u, unitSet(c.t)) > 4)) continue;
    chosen.push(a);
  }
  const gauntlet = [...presets.map(p => p.t), ...chosen.slice(0, 24).map(a => a.t)];
  {
    const jobs = [], who = [];
    chosen.forEach((a, i) => gauntlet.forEach((o, j) => {
      const s = ((i + 1) * 7919 + j * 104729 + SEED) >>> 0;
      jobs.push([a.t, o, s]), who.push([i, 0]);
      jobs.push([o, a.t, s ^ 0x5bd1e995]), who.push([i, 1]);
    }));
    const res = await runAll(jobs);
    chosen.forEach(a => { a.gw = 0; a.gn = 0; });
    res.forEach((r, k) => { const [i, side] = who[k]; chosen[i].gn++; if (r === side) chosen[i].gw++; else if (r === null) chosen[i].gw += 0.5; });
    chosen.sort((x, y) => y.gw / y.gn - x.gw / x.gn);
    console.log(`screen ${chosen.length} → ${FINAL}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  }
  const fin = chosen.slice(0, FINAL);

  // ---- 総当たり ----
  const n = fin.length, W = fin.map(() => ({ w: 0, l: 0, d: 0 })), vs = fin.map(() => fin.map(() => 0));
  const jobs = [], who = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) for (let k = 0; k < PER; k++) for (const swap of [0, 1]) {
    const [A, B] = swap ? [j, i] : [i, j];
    jobs.push([fin[A].t, fin[B].t, (i * 7919 + j * 104729 + k * 13 + swap + SEED) >>> 0]), who.push([A, B]);
  }
  const res = await runAll(jobs);
  res.forEach((r, k) => {
    const [A, B] = who[k];
    if (r === null) { W[A].d++, W[B].d++; return; }
    const w = r === 0 ? A : B, l = r === 0 ? B : A;
    W[w].w++, W[l].l++, vs[w][l]++;
  });
  const rate = s => (s.w + s.d / 2) / Math.max(1, s.w + s.l + s.d);
  const order = fin.map((_, i) => i).sort((a, b) => rate(W[b]) - rate(W[a]));
  const eqName = e => e ? (E.equipById(e)?.name ?? e) : null;
  const natName = id => ({ tanki: "短気", arakure: "荒くれ", reisei: "れいせい", zunouteki: "ずのう的", yasashii: "やさしい", nasakebukai: "情け深い", iyarashii: "いやらしい", hidou: "非道", kyouryokuteki: "協力的", kenshinteki: "けんしん的", shinchou: "しんちょう", doujinai: "動じない" })[id] ?? id;
  const show = g => `${def(g[0]).name}（${natName(g[1])}・${[eqName(g[2]), eqName(g[3])].filter(Boolean).join("＋") || "なし"}）`;
  const presetName = t => presets.find(p => key(p.t) === key(t))?.name;
  const out = order.map((i, r) => {
    const others = order.filter(j => j !== i), diff = j => vs[i][j] - vs[j][i];
    const best = others.reduce((a, j) => diff(j) > diff(a) ? j : a), worst = others.reduce((a, j) => diff(j) < diff(a) ? j : a);
    return { rank: r + 1, rate: Math.round(rate(W[i]) * 1000) / 10, w: W[i].w, l: W[i].l, d: W[i].d, preset: presetName(fin[i].t) ?? null,
      front: fin[i].t.slice(0, 3).map(show), back: fin[i].t.slice(3).map(show),
      best: { rank: order.indexOf(best) + 1, rec: `${vs[i][best]}-${vs[best][i]}` }, worst: { rank: order.indexOf(worst) + 1, rec: `${vs[i][worst]}-${vs[worst][i]}` },
      team: fin[i].t };
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`round robin ${n} teams × ${PER * 2} games/pair = ${jobs.length} games, total ${secs} s`);
  for (const o of out.slice(0, 20)) console.log(`${String(o.rank).padStart(3)} ${o.rate}%  ${o.front.join("・")} / ${o.back.join("・")}`);
  writeFileSync(join(root, "tools", "top100_result.json"), JSON.stringify({ gens: GENS, pop: POP, per: PER, seed: SEED, searched: archive.size, games: jobs.length, results: out }, null, 1));
  const md = [
    "# 妖怪の組み合わせ 上位 100 組（勝率順）",
    "",
    `\`node tools/build.mjs --engine-only && node tools/top100.mjs --gens ${GENS} --pop ${POP} --final ${FINAL} --per ${PER} --seed ${SEED}\` の結果（v${JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version}）。`,
    "",
    "## やりかた",
    "",
    `- 本家の妖怪 ${E.units.length} 体から 6 体を選ぶ組み合わせは C(${E.units.length},6) ≒ 5×10^12 通りあり、全部は戦わせられない。そこで **遺伝的アルゴリズム** で探した。`,
    `  流行りの型 6 つ・メタ候補 10 個とランダムな編成から始め、1 世代 ${POP} 編成を ${GENS} 世代。妖怪の入れかえ・持ち物（装備・魂）・性格・並び（前衛／後衛）を変え、2 つの編成をまぜ、`,
    `  流行りの型・メタ候補・その時点の上位 24 編成と 1 編成 ${OPP * 2} 戦（左右入れかえ）させた勝率で上位 ${ELITE} を残した。調べた編成は ${archive.size} 通り。`,
    `- 見つかった編成から **妖怪が 2 体以上ちがうもの** だけを ${chosen.length} 組選び、同じ相手（流行りの型・メタ候補・上位 24）と ${gauntlet.length * 2} 戦ずつさせて上位 ${FINAL} 組にしぼった。`,
    `- ${FINAL} 組を **総当たり**（1 組 ${PER * 2} 戦・左右入れかえ、合計 ${jobs.length} 戦）させた勝率で並べた。`,
    "- 戦うのは meta_sim.mjs と同じ いちばん強い CPU（アイテムなし＝対人戦と同じ・まじめさは超まじめ）。人どうしの対戦（メンバーサークル回し・パワーチャージの読み合い）では変わる。",
    "- 条件はゲームと同じ（S・A ランクは 2 体まで・グループの上限）。かっこの中は性格とそうび（「＋」は装備枠 2 つ）。得意・苦手は その編成から見た勝ち-負けと相手の順位。",
    "",
    "| 順位 | 勝率 | 勝-負-分 | 前衛（左・まん中・右） | 後衛 | 得意 | 苦手 |",
    "|---|---|---|---|---|---|---|",
    ...out.map(o => `| ${o.rank} | ${o.rate}% | ${o.w}-${o.l}-${o.d} | ${o.preset ? `**${o.preset}**：` : ""}${o.front.join("・")} | ${o.back.join("・")} | ${o.best.rank} 位 ${o.best.rec} | ${o.worst.rank} 位 ${o.worst.rec} |`),
    "",
  ].join("\n");
  writeFileSync(join(root, "docs", "TOP100.md"), md);
  console.log("wrote docs/TOP100.md, tools/top100_result.json");
  for (const w of workers) w.terminate();
}
