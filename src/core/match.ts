// 試合を最後まで回す・リプレイを再生する。

import type { BattleEvent } from "./events.js";
import type { Input, InputRecord, PlayerInput } from "./input.js";
import { type BattleState, createBattle, type PlayerId } from "./state.js";
import { stepInPlace } from "./step.js";
import type { TeamSpec } from "./team.js";

/** その tick に出す入力を決めるもの（CPU・人・通信） */
export type Controller = (state: BattleState, player: PlayerId) => Input[];

export interface Replay {
  seed: number;
  teams: [TeamSpec, TeamSpec];
  inputs: InputRecord[];
}

export interface MatchResult {
  state: BattleState;
  replay: Replay;
}

export function runMatch(
  seed: number,
  teams: [TeamSpec, TeamSpec],
  controllers: [Controller, Controller],
  onEvent?: (e: BattleEvent, tick: number) => void,
): MatchResult {
  const s = createBattle(seed, teams[0], teams[1]);
  const log: InputRecord[] = [];
  const events: BattleEvent[] = [];
  while (!s.outcome) {
    const inputs: PlayerInput[] = [];
    for (const pid of [0, 1] as const) {
      for (const input of controllers[pid](s, pid)) {
        inputs.push({ player: pid, input });
        log.push({ tick: s.tick, player: pid, input });
      }
    }
    const tick = s.tick;
    events.length = 0;
    stepInPlace(s, inputs, events);
    if (onEvent) for (const e of events) onEvent(e, tick);
  }
  return { state: s, replay: { seed, teams, inputs: log } };
}

/** シードと入力列だけで試合を再生する */
export function playReplay(r: Replay, onEvent?: (e: BattleEvent, tick: number) => void): BattleState {
  const s = createBattle(r.seed, r.teams[0], r.teams[1]);
  let i = 0;
  const events: BattleEvent[] = [];
  while (!s.outcome) {
    const inputs: PlayerInput[] = [];
    while (i < r.inputs.length && r.inputs[i].tick === s.tick) {
      inputs.push({ player: r.inputs[i].player, input: r.inputs[i].input });
      i++;
    }
    const tick = s.tick;
    events.length = 0;
    stepInPlace(s, inputs, events);
    if (onEvent) for (const e of events) onEvent(e, tick);
  }
  return s;
}
