import {
  type BattleEvent,
  type BattleState,
  createBattle,
  type Input,
  type PlayerId,
  stepInPlace,
  type TeamSpec,
} from "../src/core/index.js";

/** ランク制限を守った、いろいろな種類の入ったチーム */
export const TEAM_A: TeamSpec = [
  { unit: "oni" },
  { unit: "yukionna" },
  { unit: "kappa" },
  { unit: "karakasa" },
  { unit: "zashiki" },
  { unit: "kodama" },
];

export const TEAM_B: TeamSpec = [
  { unit: "tengu" },
  { unit: "kamaitachi" },
  { unit: "nekomata" },
  { unit: "ogama" },
  { unit: "bakedanuki" },
  { unit: "rokurokubi" },
];

export function battle(seed = 1, a: TeamSpec = TEAM_A, b: TeamSpec = TEAM_B): BattleState {
  return createBattle(seed, a, b);
}

/** 全員の行動を止める（AG を増やさないように SPD を 0 にはできないので、毎 tick AG を 0 に戻す用） */
export function freezeAg(s: BattleState): void {
  for (const p of s.players) for (const u of p.units) u.ag = 0;
}

/** 1 tick 進める。inputs は [player, input] の組 */
export function tick(s: BattleState, ...inputs: [PlayerId, Input][]): BattleEvent[] {
  const events: BattleEvent[] = [];
  stepInPlace(
    s,
    inputs.map(([player, input]) => ({ player, input })),
    events,
  );
  return events;
}

/** 行動させずに n tick 進める */
export function idle(s: BattleState, n: number): BattleEvent[] {
  const all: BattleEvent[] = [];
  for (let i = 0; i < n; i++) {
    freezeAg(s);
    all.push(...tick(s));
  }
  return all;
}

/** 行動させずに 1 tick 進める */
export function ftick(s: BattleState, ...inputs: [PlayerId, Input][]): BattleEvent[] {
  freezeAg(s);
  return tick(s, ...inputs);
}
