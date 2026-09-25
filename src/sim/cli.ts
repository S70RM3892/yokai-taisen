// CPU どうしで試合をたくさん回して集計する（BATTLE_SPEC §15）。
// 使い方: npm run sim -- --matches 10000 --seed 1 [--json]

import {
  createCpu,
  cpuThink,
  EQUIPMENT,
  NATURES,
  runMatch,
  TICKS_PER_SEC,
  UNITS,
  type BattleEvent,
  type Controller,
  type Tribe,
} from "../core/index.js";
import { createStream, nextU32 } from "../core/rng.js";
import { EFFORT_PRESETS, randomTeam, toTeamSpec, type GeneratedMember } from "./teamgen.js";

interface Tally {
  games: number;
  score: number; // 勝ち 1、引き分け 0.5
}

function add(map: Map<string, Tally>, key: string, score: number): void {
  const t = map.get(key) ?? { games: 0, score: 0 };
  t.games++;
  t.score += score;
  map.set(key, t);
}

function parseArgs(argv: string[]): { matches: number; seed: number; json: boolean } {
  const get = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    matches: Number(get("--matches") ?? 10000),
    seed: Number(get("--seed") ?? 1) >>> 0,
    json: argv.includes("--json"),
  };
}

const TRIBE_NAME: Record<Tribe, string> = {
  takeru: "猛", ayashi: "怪", tsuwamono: "剛", kage: "影", nagomi: "和", miyabi: "雅", tatari: "祟", shizume: "鎮", maga: "禍",
};

/** 最初の前衛が受けている陣（ホイールで隣り合った同じ種族のつながり。§9） */
function initialFormation(team: GeneratedMember[]): string {
  const tribes = team.map((m) => UNITS.find((u) => u.id === m.unit)!.tribe);
  const found = new Set<string>();
  for (let pos = 0; pos < 3; pos++) {
    const t = tribes[pos];
    let right = 0;
    while (right < 5 && tribes[(pos + right + 1) % 6] === t) right++;
    let left = 0;
    while (left < 5 - right && tribes[(pos - left - 1 + 6) % 6] === t) left++;
    const n = 1 + right + left;
    if (n >= 2) found.add(`${TRIBE_NAME[t]}${Math.min(n, 3)}`);
  }
  return found.size ? [...found].sort().join("+") : "なし";
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const gen = createStream(args.seed, 9999);

  const byUnit = new Map<string, Tally>();
  const byNature = new Map<string, Tally>();
  const byEffort = new Map<string, Tally>();
  const byEquip = new Map<string, Tally>();
  const byFormation = new Map<string, Tally>();
  let ticksTotal = 0;
  let minTicks = Infinity;
  let maxTicks = 0;
  let koEnds = 0;
  let timeEnds = 0;
  let p1Wins = 0;
  let draws = 0;
  let ultNormal = 0;
  let ultGrand = 0;
  let perfect = 0;
  let pokes = 0;
  let pokeSuccess = 0;

  const started = Date.now();
  for (let m = 0; m < args.matches; m++) {
    const matchSeed = nextU32(gen);
    const teams = [randomTeam(gen), randomTeam(gen)];
    const cpus = [createCpu(0, matchSeed ^ 0x5bd1e995), createCpu(1, matchSeed ^ 0x5bd1e995)];
    const controllers: [Controller, Controller] = [(s) => cpuThink(cpus[0], s), (s) => cpuThink(cpus[1], s)];
    const onEvent = (e: BattleEvent): void => {
      if (e.t === "ult") {
        if (e.grand) ultGrand++;
        else ultNormal++;
        if (e.quality === "perfect") perfect++;
      } else if (e.t === "pokeStart") pokes++;
      else if (e.t === "pokeEnd" && e.result === "success") pokeSuccess++;
    };
    const { state } = runMatch(matchSeed, [toTeamSpec(teams[0]), toTeamSpec(teams[1])], controllers, onEvent);
    const o = state.outcome!;
    ticksTotal += state.tick;
    minTicks = Math.min(minTicks, state.tick);
    maxTicks = Math.max(maxTicks, state.tick);
    if (o.reason === "ko") koEnds++;
    else timeEnds++;
    if (o.winner === 0) p1Wins++;
    if (o.winner === null) draws++;

    for (const p of [0, 1] as const) {
      const score = o.winner === null ? 0.5 : o.winner === p ? 1 : 0;
      for (const mem of teams[p]) {
        add(byUnit, mem.unit, score);
        add(byNature, mem.nature!, score);
        add(byEffort, mem.effortPreset, score);
        add(byEquip, mem.equipment ?? "(なし)", score);
      }
      add(byFormation, initialFormation(teams[p]), score);
    }
  }
  const elapsedMs = Date.now() - started;

  const n = args.matches;
  const ults = ultNormal + ultGrand;
  const summary = {
    matches: n,
    seed: args.seed,
    avgSeconds: ticksTotal / n / TICKS_PER_SEC,
    minSeconds: minTicks / TICKS_PER_SEC,
    maxSeconds: maxTicks / TICKS_PER_SEC,
    koRate: koEnds / n,
    timeoutRate: timeEnds / n,
    p1WinRate: p1Wins / n,
    drawRate: draws / n,
    ultsPerMatch: ults / n,
    grandShare: ults ? ultGrand / ults : 0,
    perfectShare: ults ? perfect / ults : 0,
    pokesPerMatch: pokes / n,
    pokeSuccessRate: pokes ? pokeSuccess / pokes : 0,
    simMs: elapsedMs,
  };

  const label = {
    unit: (k: string) => UNITS.find((u) => u.id === k)?.name ?? k,
    nature: (k: string) => NATURES.find((x) => x.id === k)?.name ?? k,
    effort: (k: string) => EFFORT_PRESETS.find((x) => x.id === k)?.name ?? k,
    equip: (k: string) => EQUIPMENT.find((x) => x.id === k)?.name ?? k,
    formation: (k: string) => k,
  };
  const table = (map: Map<string, Tally>, name: (k: string) => string) =>
    [...map.entries()]
      .map(([k, t]) => ({ key: k, name: name(k), games: t.games, winRate: t.score / t.games }))
      .sort((a, b) => b.winRate - a.winRate);

  const tables = {
    unit: table(byUnit, label.unit),
    nature: table(byNature, label.nature),
    effort: table(byEffort, label.effort),
    equipment: table(byEquip, label.equip),
    formation: table(byFormation, label.formation),
  };

  if (args.json) {
    console.log(JSON.stringify({ summary, tables }, null, 2));
    return;
  }

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log(`# シミュレーション ${n} 試合（seed ${args.seed}、${(elapsedMs / 1000).toFixed(1)} 秒）`);
  console.log(
    `試合時間 平均 ${summary.avgSeconds.toFixed(1)} 秒（最短 ${summary.minSeconds.toFixed(1)}・最長 ${summary.maxSeconds.toFixed(1)}）`,
  );
  console.log(`決着 全滅 ${pct(summary.koRate)}・時間切れ ${pct(summary.timeoutRate)}・引き分け ${pct(summary.drawRate)}`);
  console.log(`P1 の勝率 ${pct(summary.p1WinRate)}`);
  console.log(
    `奥義 1試合 ${summary.ultsPerMatch.toFixed(2)} 回（大奥義 ${pct(summary.grandShare)}・Perfect ${pct(summary.perfectShare)}）`,
  );
  console.log(`つつき 1試合 ${summary.pokesPerMatch.toFixed(2)} 回（成功 ${pct(summary.pokeSuccessRate)}）`);
  for (const [title, rows] of [
    ["ユニット", tables.unit],
    ["性格", tables.nature],
    ["努力ポイント", tables.effort],
    ["装備", tables.equipment],
    ["最初の陣", tables.formation],
  ] as const) {
    console.log(`\n## ${title}別の勝率`);
    for (const r of rows) console.log(`  ${r.name.padEnd(8, "　")} ${pct(r.winRate).padStart(6)}  (${r.games})`);
  }
}

main();
