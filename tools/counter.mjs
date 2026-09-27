// 相手の編成（書き出した「YT1:…」）に勝てる編成と、その編成の操作（メンバーサークル回し・ひっさつわざのタイミング・ねらう相手）を
// いっしょに探す。操作は tools/human_cpu.mjs の方針（THETA）を数値で変えて進化させ、手先は最強（パワーチャージは毎回完璧）。
// 相手の操作も弱くしない：いちばん強い CPU・人のモデル・手先が最強の人のモデルに加えて、ときどき
// 「いまの いちばんよい編成と操作に勝つように相手の操作を進化させた方針」を相手に足していく（読み合い）。
// いちばん苦手な操作の相手への勝率も重く見る（点＝平均の半分＋最低の半分）。
//   node tools/build.mjs --engine-only && node tools/counter.mjs YT1:… [--gens 40] [--pop 120] [--games 6] [--adv 8] [--seed 1] [--out docs/COUNTER.md]
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { newHuman, humanInputs, THETA0, THETA_SPEC, HUMAN_PARAMS, PERFECT_PARAMS } from "./human_cpu.mjs";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const E = require(join(root, "dist", "engine.cjs"));
const SMART = { perfectPermil: 1000, pokeHitPermil: 950, grandPermil: 1000, smart: true, itemPermil: 0 };

// 遺伝子 [妖怪 id, 性格, そうび 1, そうび 2, まじめさ] → 対戦のメンバー
const toMembers = t => t.map(([unit, nature, eq, eq2, dil]) => {
  const m = { unit, diligence: dil ?? "choumajime" };
  if (nature) m.nature = nature;
  if (eq) m.equipment = eq;
  if (eq2) m.equipment2 = eq2;
  return m;
});
// ctl：{ kind: "smart" } か { kind: "human", th, perfect }
const makeCtl = (ctl, player, seed) => ctl.kind === "smart" ? { c: E.newCpu(player, seed, SMART), f: E.cpuInputs }
  : { c: newHuman(E, player, seed, ctl.th, ctl.perfect ? PERFECT_PARAMS : HUMAN_PARAMS), f: humanInputs };
// a が 0 番側。{ w: 勝った側（0/1）か null, hp: 決着したときの 0 番側と 1 番側の残り HP の割合 }
function play(a, ca, b, cb, seed) {
  const st = E.newBattle(seed, toMembers(a), toMembers(b), { noItems: true });
  const cs = [makeCtl(ca, 0, seed ^ 11), makeCtl(cb, 1, seed ^ 22)];
  for (let g = 0; !st.outcome && g < 30000; g++) {
    const inputs = [];
    for (const p of [0, 1]) for (const input of cs[p].f(cs[p].c, st)) inputs.push({ player: p, input });
    E.step(st, inputs, []);
  }
  const hp = st.players.map(p => p.units.reduce((s, u) => s + Math.max(0, u.hp), 0) / p.units.reduce((s, u) => s + u.maxHp, 0));
  return { w: st.outcome?.winner ?? null, hp };
}
// job：[わたしの編成, わたしの操作, 相手の編成, 相手の操作, seed, わたしが 1 番側か]
//   → [1 勝ち・0 負け・0.5 引き分け, 余裕（わたしの残り HP の割合 − 相手の残り HP の割合）]
function job([t, ct, o, co, seed, swap]) {
  const { w, hp } = swap ? play(o, co, t, ct, seed) : play(t, ct, o, co, seed);
  const me = swap ? 1 : 0;
  return [w === null ? 0.5 : (w === me ? 1 : 0), hp[me] - hp[1 - me]];
}

if (!isMainThread) parentPort.on("message", ({ id, jobs }) => parentPort.postMessage({ id, res: jobs.map(job) }));
else await main();

async function main() {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
  const GENS = +opt("gens", 40), POP = +opt("pop", 120), GAMES = +opt("games", 6), ADV = +opt("adv", 8), SEED = +opt("seed", 1);
  const OUT = opt("out", "docs/COUNTER.md");
  const ELITE = Math.round(POP * 0.2);
  let code = args.find(a => a.startsWith("YT1:")) ?? (existsSync(args[0] ?? "") ? readFileSync(args[0], "utf8").trim() : null);
  if (!code) throw new Error("相手の編成（YT1:…）を渡してください");
  let rs = (SEED * 2654435761) >>> 0 || 1;
  const rnd = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());

  // ---- 相手の編成 ----
  const o = JSON.parse(Buffer.from(code.slice(4), "base64").toString("utf8"));
  const byNo = n => E.units.find(x => x.no === n), byName = n => E.units.find(x => x.name === n);
  const unitRef = x => typeof x[0] === "number" ? (byNo(x[0]) ?? byName(x[1])) : (E.units.find(u => u.id === x[0]) ?? byName(x[1]));
  const eqRef = e => !e ? null : e.soul ? "soul:" + (e.soul.no ? byNo(e.soul.no) : e.soul.id ? E.units.find(u => u.id === e.soul.id) : byName(e.soul.name)).id : e.id;
  const target = o.m.map(x => { const d = unitRef(x); if (!d) throw new Error(`知らない妖怪 ${x[1]}`); return [d.id, x[2] ?? null, eqRef(x[4]), eqRef(x[5]), x[3] ?? "choumajime"]; });
  const terr = E.validateTeam(toMembers(target));
  if (terr.length) throw new Error(`相手の編成が組めない：${terr.join(" / ")}`);

  // ---- worker ----
  const workers = Array.from({ length: Math.max(1, availableParallelism()) }, () => new Worker(fileURLToPath(import.meta.url)));
  let jobId = 0;
  const pending = new Map();
  for (const w of workers) w.on("message", ({ id, res }) => { pending.get(id)(res); pending.delete(id); });
  async function runAll(jobs) {
    const out = new Array(jobs.length), idle = [...workers];
    let next = 0, running = 0;
    await new Promise(done => {
      const pump = () => {
        while (idle.length && next < jobs.length) {
          const w = idle.pop(), from = next, part = jobs.slice(from, from + 6), id = jobId++;
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

  // ---- 編成の遺伝子（top100.mjs と同じ作り） ----
  const def = id => E.units.find(x => x.id === id);
  const soul = n => "soul:" + byName(n).id;
  const strongEq = ["densetsu_udewa", "kishin_udewa", "densetsu_yubiwa", "kishin_yubiwa", "teppeki_omamori", "densetsu_omamori", "kishin_omamori",
    "densetsu_badge", "kishin_badge", "jugon_katana", "jugon_tsue", "jugon_tate", "gokuraku_dama",
    ...E.equips.filter(e => e.cat === "レア魂").map(e => e.id),
    ...["ルビーニャン", "サファイニャン", "エメラルニャン", "トパーニャン", "ダイヤニャン", "えんらえんら", "メゾン・ドワスレ", "フユニャン", "ミカンニャン", "アライ魔将"].filter(byName).map(soul)];
  const allSouls = E.units.filter(d => E.equipById("soul:" + d.id)).map(d => "soul:" + d.id);
  function randEq(d) {
    const r = rnd();
    if (r < 0.7) for (let k = 0; k < 20; k++) { const e = pick(strongEq); if (E.equipById(e) && E.equipAllowed(d, e)) return e; }
    if (r < 0.85) return pick(allSouls);
    return pick(E.equipChoices(d).filter(e => !e.special?.allMult && !e.special?.noBattleEffect)).id;
  }
  const NAT = ["tanki", "arakure", "reisei", "zunouteki", "yasashii", "nasakebukai", "iyarashii", "hidou", "kyouryokuteki", "kenshinteki", "shinchou", "doujinai"];
  const randNat = d => rnd() < 0.6 ? pick(d.atk >= d.spa ? ["arakure", "doujinai", "kyouryokuteki"] : ["zunouteki", "doujinai", "kyouryokuteki"]) : pick(NAT);
  const gene = d => [d.id, randNat(d), randEq(d), E.equipSlots(d) === 2 ? randEq(d) : null, "choumajime"];
  const valid = t => E.validateTeam(toMembers(t)).length === 0;
  const repair = t => { for (let k = 0; k < 60 && !valid(t); k++) t[Math.floor(rnd() * 6)] = gene(pick(E.units)); return valid(t) ? t : null; };
  const randomTeam = () => repair(E.randomTeam(E.seedRng(Math.floor(rnd() * 1e9), 1)).map(m => gene(def(m.unit))));
  function mutateTeam(t0) {
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
  // ---- 操作の遺伝子 ----
  const clampTh = th => Object.fromEntries(Object.entries(THETA_SPEC).map(([k, [lo, hi]]) => [k, Math.min(hi, Math.max(lo, th[k]))]));
  function mutateTh(th0, scale = 1) {
    const th = { ...th0 };
    for (const [k, [lo, hi]] of Object.entries(THETA_SPEC)) if (rnd() < 0.3) th[k] += gauss() * (hi - lo) * 0.15 * scale;
    return clampTh(th);
  }
  const crossTh = (a, b) => Object.fromEntries(Object.keys(THETA_SPEC).map(k => [k, rnd() < 0.5 ? a[k] : b[k]]));
  const round = th => Object.fromEntries(Object.entries(th).map(([k, v]) => [k, Math.round(v * 100) / 100]));

  // ---- 相手の操作のプール ----
  const opps = [
    { name: "いちばん強い CPU", ctl: { kind: "smart" } },
    { name: "人のモデル", ctl: { kind: "human", th: THETA0 } },
    { name: "人のモデル（手先が最強）", ctl: { kind: "human", th: THETA0, perfect: true } },
  ];

  // ---- 最初の候補：上位 100 組（CPU 版・人の版）とランダム ----
  const seeds = [];
  for (const f of ["tools/top100_human_result.json", "tools/top100_result.json"]) {
    const p = join(root, f);
    if (existsSync(p)) for (const r of JSON.parse(readFileSync(p, "utf8")).results.slice(0, 40)) seeds.push(r.team.map(g => [...g.slice(0, 4), "choumajime"]));
  }
  let pop = [];
  for (const t of seeds) if (valid(t) && pop.length < POP * 0.6) pop.push({ t, th: pop.length % 2 ? mutateTh(THETA0) : { ...THETA0 } });
  while (pop.length < POP) { const t = randomTeam(); if (t) pop.push({ t, th: mutateTh(THETA0, 2) }); }

  const ours = c => ({ kind: "human", th: c.th, perfect: true });
  let seedN = SEED * 1000003;
  // c を相手のプールのそれぞれと games 戦（左右入れかえ）
  async function evaluate(cands, pool, games) {
    const jobs = [], who = [];
    cands.forEach((c, i) => pool.forEach((op, j) => { for (let k = 0; k < games; k++) { jobs.push([c.t, ours(c), target, op.ctl, (seedN++ * 2654435761) >>> 0, k % 2]); who.push([i, j]); } }));
    const res = await runAll(jobs);
    const s = cands.map(() => pool.map(() => [0, 0, 0]));
    res.forEach(([r, m], k) => { const [i, j] = who[k]; s[i][j][0] += r, s[i][j][1]++, s[i][j][2] += m; });
    cands.forEach((c, i) => {
      c.per = s[i].map(([w, n]) => w / n);
      c.margin = s[i].reduce((a, [, n, m]) => a + m / n, 0) / pool.length;
      const mean = c.per.reduce((a, b) => a + b, 0) / c.per.length, min = Math.min(...c.per);
      // 勝率が同じなら、余裕をもって勝てる（HP を多く残す）ほうを上に
      c.fit = 0.5 * mean + 0.5 * min + 0.1 * c.margin, c.mean = mean, c.min = min;
    });
  }
  // 相手の操作を、いまの上位の編成と操作に勝つように進化させる
  async function adversary(tops) {
    let ap = [{ th: { ...THETA0 } }, ...opps.filter(x => x.ctl.th && x.learned).map(x => ({ th: x.ctl.th }))];
    while (ap.length < 24) ap.push({ th: mutateTh(pick(ap).th, 2) });
    for (let g = 0; g < 10; g++) {
      const jobs = [], who = [];
      ap.forEach((a, i) => tops.forEach(c => { for (let k = 0; k < 8; k++) { jobs.push([c.t, ours(c), target, { kind: "human", th: a.th, perfect: true }, (seedN++ * 2654435761) >>> 0, k % 2]); who.push(i); } }));
      const res = await runAll(jobs);
      ap.forEach(a => { a.w = 0; a.n = 0; a.m = 0; });
      res.forEach(([r, m], k) => { ap[who[k]].w += 1 - r, ap[who[k]].n++, ap[who[k]].m -= m; });
      const sc = a => (a.w + 0.1 * a.m) / a.n;
      ap.sort((x, y) => sc(y) - sc(x));
      const keep = ap.slice(0, 8);
      ap = [...keep];
      while (ap.length < 24) ap.push({ th: rnd() < 0.3 ? mutateTh(crossTh(pick(keep).th, pick(keep).th)) : mutateTh(pick(keep).th) });
    }
    return { th: ap[0].th, rate: ap[0].w / ap[0].n };
  }

  const t0 = Date.now();
  let learnedN = 0;
  for (let gen = 0; gen < GENS; gen++) {
    await evaluate(pop, opps, GAMES);
    pop.sort((a, b) => b.fit - a.fit);
    const top = pop[0];
    console.log(`gen ${gen + 1}/${GENS} ${((Date.now() - t0) / 1000).toFixed(0)} s  best ${(top.fit * 100).toFixed(1)}（余裕 ${(top.margin * 100).toFixed(0)}%・平均 ${(top.mean * 100).toFixed(0)}%・最低 ${(top.min * 100).toFixed(0)}%）${top.t.map(g => def(g[0]).name).join("・")}  相手の操作 ${opps.length}`);
    if (ADV > 0 && (gen + 1) % ADV === 0 && gen + 1 < GENS) {
      const a = await adversary(pop.slice(0, 3));
      learnedN++;
      opps.push({ name: `相手の操作（学習 ${learnedN}）`, learned: true, ctl: { kind: "human", th: a.th, perfect: true } });
      if (opps.filter(x => x.learned).length > 4) opps.splice(opps.findIndex(x => x.learned), 1);
      console.log(`  相手の操作を学習：上位 3 つに ${(a.rate * 100).toFixed(0)}% 勝つ方針を足した`);
    }
    const keep = pop.slice(0, ELITE), next = keep.map(c => ({ t: c.t, th: c.th }));
    const seen = new Set(next.map(c => JSON.stringify(c)));
    const tour = () => { let b = null; for (let k = 0; k < 3; k++) { const c = pop[Math.floor(rnd() * POP / 2)]; if (!b || c.fit > b.fit) b = c; } return b; };
    let guard = 0;
    while (next.length < POP && guard++ < POP * 50) {
      const a = tour(), r = rnd();
      let c;
      if (r < 0.35) c = { t: mutateTeam(a.t), th: a.th };                       // 編成だけ変える
      else if (r < 0.65) c = { t: a.t, th: mutateTh(a.th) };                     // 操作だけ変える
      else if (r < 0.85) { const b = tour(); c = { t: rnd() < 0.5 ? a.t : b.t, th: crossTh(a.th, b.th) }; } // 操作をまぜる
      else if (r < 0.95) { const b = tour(); c = { t: repair(a.t.map((g, i) => [...(rnd() < 0.5 ? g : b.t[i])])), th: a.th }; }
      else c = { t: randomTeam(), th: a.th };
      if (!c.t) continue;
      const k = JSON.stringify(c);
      if (seen.has(k)) continue;
      seen.add(k), next.push(c);
    }
    pop = next;
  }

  // ---- 最後：上位の編成（ちがう編成 8 つ）をたくさん戦わせて確かめる ----
  await evaluate(pop, opps, GAMES);
  pop.sort((a, b) => b.fit - a.fit);
  const fin = [];
  for (const c of pop) { if (fin.length >= 8) break; if (!fin.some(f => JSON.stringify(f.t) === JSON.stringify(c.t))) fin.push({ t: c.t, th: c.th }); }
  const FINAL_GAMES = 60;
  await evaluate(fin, opps, FINAL_GAMES);
  fin.sort((a, b) => b.fit - a.fit);
  // 同じ編成を、学習前の操作（人のモデル・手先は最強）で動かしたときと、学習した操作を人の手先で動かしたとき
  const base = fin.map(c => ({ t: c.t, th: { ...THETA0 } }));
  await evaluate(base, opps, FINAL_GAMES);
  const humanHands = [];
  {
    const jobs = [], who = [];
    fin.forEach((c, i) => opps.forEach(op => { for (let k = 0; k < FINAL_GAMES; k++) { jobs.push([c.t, { kind: "human", th: c.th }, target, op.ctl, (seedN++ * 2654435761) >>> 0, k % 2]); who.push(i); } }));
    const res = await runAll(jobs);
    fin.forEach(() => humanHands.push([0, 0]));
    res.forEach(([r], k) => { humanHands[who[k]][0] += r, humanHands[who[k]][1]++; });
  }

  // ---- 書き出し ----
  const NAT_JA = { tanki: "短気", arakure: "荒くれ", reisei: "れいせい", zunouteki: "ずのう的", yasashii: "やさしい", nasakebukai: "情け深い", iyarashii: "いやらしい", hidou: "非道", kyouryokuteki: "協力的", kenshinteki: "けんしん的", shinchou: "しんちょう", doujinai: "動じない" };
  const eqName = e => e ? (E.equipById(e)?.name ?? e) : null;
  const show = g => `${def(g[0]).name}（${g[1] ? NAT_JA[g[1]] ?? g[1] : "性格そのまま"}・${[eqName(g[2]), eqName(g[3])].filter(Boolean).join("＋") || "なし"}）`;
  const eqRefOut = e => !e ? null : e.startsWith("soul:") ? { soul: { no: def(e.slice(5)).no, name: def(e.slice(5)).name } } : { id: e, name: eqName(e) };
  const encode = (t, name) => "YT1:" + Buffer.from(JSON.stringify({ f: 1, n: name, m: t.map(g => [def(g[0]).no, def(g[0]).name, g[1], g[4] ?? "choumajime", eqRefOut(g[2]), ...(g[3] ? [eqRefOut(g[3])] : [])]), b: [] }), "utf8").toString("base64");
  const pct = x => `${Math.round(x * 100)}%`;
  const best = fin[0];
  const words = th => {
    const L = [];
    const d = (k, f) => { const [lo, hi, v0, s] = THETA_SPEC[k]; L.push(`| ${s} | ${round({ x: th[k] }).x} | ${v0} |${f ? ` ${f}` : ""}`); };
    for (const k of Object.keys(THETA_SPEC)) d(k);
    return L;
  };
  const rules = th => {
    const r = [];
    const w = (d) => r.push(`- ${d}`);
    w(`**メンバーサークル**：回したあとの前衛の点が ${th.rotThresh.toFixed(1)} 点より上がるときだけ回す（1 歩 ${th.stepCost.toFixed(2)} 点引く）。前衛 1 体の点は 動ければ ${th.base.toFixed(1)}＋HP の割合×${th.hp.toFixed(1)}、とりつかれていれば −${th.curse.toFixed(1)}、妖気がたまっていれば ＋${th.ult.toFixed(1)}、HP が ${Math.round(th.lowHp * 100)}% より少なければ −${th.lowHpPen.toFixed(1)}。後衛のとりつかれた妖怪は ＋${th.backCurse.toFixed(1)}`);
    const beats = [];
    if (th.ult > th.rotThresh + th.stepCost) beats.push("妖気がたまった後衛を前に出す");
    if (th.curse + th.backCurse > th.rotThresh + th.stepCost) beats.push("とりつかれた前衛を下げる");
    if (th.lowHpPen > th.rotThresh + th.stepCost) beats.push(`HP ${Math.round(th.lowHp * 100)}% 未満の前衛を下げる`);
    w(`つまり 1 歩で回すのは：${beats.length ? beats.join("・") : "気絶した前衛の入れかえだけ"}`);
    w(`**ひっさつわざ**：妖気がたまったら、だれかのモーション中にパワーチャージを始める。モーションがなければ最長 ${(th.ultWait / 20).toFixed(1)} 秒待つ${th.skipImmune > 0.5 ? "。相手の前衛が全員 ひっさつわざを受けない（かたすかし）ときは撃たない" : ""}`);
    w(th.ownTarget > 0.5 ? `**ねらう**：HP の割合 ÷ 重みが いちばん小さい相手。重み＝1000＋弱点 ${Math.round(th.tWeak)}＋とりつかれ・サボり ${Math.round(th.tCurse)}−ガード中 ${Math.round(th.tGuard)}＋ちから・ようりょく/200×${Math.round(th.tAtk)}＋ひっさつわざを受けない ${Math.round(th.tImmune)}` : "**ねらう**：ふつうの CPU と同じ（HP の割合が低い・弱点・とりつかれ中の相手）");
    w(`**判断の間隔**：${(th.think / 20).toFixed(2)}〜${((th.think + th.thinkJit) / 20).toFixed(2)} 秒ごと`);
    return r;
  };
  const md = [
    "# 相手の編成に勝つ編成と操作",
    "",
    `\`node tools/build.mjs --engine-only && node tools/counter.mjs <YT1:…> ${args.filter(a => !a.startsWith("YT1:")).join(" ")}\` の結果（${((Date.now() - t0) / 60000).toFixed(0)} 分）。`,
    "",
    "## 相手の編成",
    "",
    `前衛：${target.slice(0, 3).map(show).join("・")}`,
    "",
    `後衛：${target.slice(3).map(show).join("・")}`,
    "",
    "（対人戦と同じく アイテムはなし。まじめさは書き出しのとおり）",
    "",
    "## やりかた",
    "",
    `- 編成（6 体・性格・そうび・並び）と **操作の方針**（\`tools/human_cpu.mjs\` の THETA：メンバーサークルを回す基準・ひっさつわざのタイミング・ねらう相手・判断の間隔）を 1 つの遺伝子にして、1 世代 ${POP} 個を ${GENS} 世代 進化させた。手先は最強（パワーチャージは毎回完璧・つつくの命中 95%）。`,
    `- 最初の候補は 上位 100 組（人の版・CPU 版）の上位とランダムな編成。`,
    `- 相手の操作：いちばん強い CPU・人のモデル・手先が最強の人のモデル から始め、${ADV} 世代ごとに「いまの上位 3 つに勝つように相手の操作の方針を進化させたもの」を足した（読み合い。学習した相手は新しい 4 つまで）。`,
    `- 点＝（相手の操作それぞれへの勝率の平均）の半分＋（いちばん低い勝率）の半分＋0.1×余裕（決着したときの こちらと相手の残り HP の割合の差の平均。勝率が同じなら圧勝できるほうを上に）。1 世代は相手の操作 1 つにつき ${GAMES} 戦（左右入れかえ）。最後に上位 8 編成を 相手の操作 1 つにつき ${FINAL_GAMES} 戦させた。`,
    "",
    "## いちばんよい編成",
    "",
    `前衛：${best.t.slice(0, 3).map(show).join("・")}`,
    "",
    `後衛：${best.t.slice(3).map(show).join("・")}`,
    "",
    "読みこみ用（編成画面のマイセット →「…」→ 読みこみ）：",
    "",
    "```",
    encode(best.t, "カウンター"),
    "```",
    "",
    "| 相手の操作 | 学習した操作（手先最強） | 学習前の操作（人のモデル・手先最強） |",
    "|---|---|---|",
    ...opps.map((op, j) => `| ${op.name} | ${pct(best.per[j])} | ${pct(base[0].per[j])} |`),
    `| **平均** | **${pct(best.mean)}** | ${pct(base[0].mean)} |`,
    `| 余裕（残り HP の差） | ${pct(best.margin)} | ${pct(base[0].margin)} |`,
    "",
    `学習した操作を 人の手先（パワーチャージの完璧 75%・つつくの命中 70%）で動かすと：${pct(humanHands[0][0] / humanHands[0][1])}（相手の操作すべての平均）`,
    "",
    "### 学習した操作（そのまま まねできる形）",
    "",
    ...rules(best.th),
    "",
    "| 方針 | 学習した値 | 人のモデルの値 |",
    "|---|---|---|",
    ...words(best.th),
    "",
    "## 上位 8 編成",
    "",
    "| # | 平均 | 最低 | 余裕 | 学習前の操作だと | 人の手先だと | 前衛 | 後衛 |",
    "|---|---|---|---|---|---|---|---|",
    ...fin.map((c, i) => `| ${i + 1} | ${pct(c.mean)} | ${pct(c.min)} | ${pct(c.margin)} | ${pct(base[i].mean)} | ${pct(humanHands[i][0] / humanHands[i][1])} | ${c.t.slice(0, 3).map(show).join("・")} | ${c.t.slice(3).map(show).join("・")} |`),
    "",
  ].join("\n");
  writeFileSync(join(root, OUT), md);
  writeFileSync(join(root, OUT.replace(/\.md$/, "_result.json").replace(/^docs\//, "tools/").toLowerCase()), JSON.stringify({ target, opps: opps.map(o => ({ name: o.name, th: o.ctl.th ? round(o.ctl.th) : null })), results: fin.map((c, i) => ({ team: c.t, th: round(c.th), per: c.per, margin: c.margin, mean: c.mean, min: c.min, baseMean: base[i].mean, humanHands: humanHands[i][0] / humanHands[i][1], code: encode(c.t, `カウンター${i + 1}`) })) }, null, 1));
  console.log(`wrote ${OUT}`);
  console.log(md.split("\n").slice(20, 45).join("\n"));
  for (const w of workers) w.terminate();
}
