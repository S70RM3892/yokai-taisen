// シミュレーター用の単純な CPU（BATTLE_SPEC §12.8）。強さは求めない。
// CPU の乱数は試合の乱数とは別の流れ（CPU 自身のシード）を使う。
// CPU は「プレイヤーに見えている情報」だけを使う想定（相手の乱数の状態などは見ない）。

import * as C from "./constants.js";
import type { Input } from "./input.js";
import { createStream, randInt, type RngState } from "./rng.js";
import { aliveFront, type BattleState, hpRatio, isAlive, isFront, type PlayerId, type UnitState } from "./state.js";

export interface CpuParams {
  /** 構えで Perfect を出す確率（‰） */
  perfectPermil: number;
  /** つつきで弱点に当てる確率（‰） */
  pokeHitPermil: number;
  /** 大奥義の条件がそろったときに大奥義を選ぶ確率（‰） */
  grandPermil: number;
}

export const DEFAULT_CPU_PARAMS: CpuParams = { perfectPermil: 500, pokeHitPermil: 400, grandPermil: 500 };

export interface Cpu {
  player: PlayerId;
  params: CpuParams;
  rng: RngState;
  /** 今の構えを何 tick の溜めで解放するか */
  releaseAt: number | null;
}

export function createCpu(player: PlayerId, seed: number, params: CpuParams = DEFAULT_CPU_PARAMS): Cpu {
  return { player, params, rng: createStream(seed, 1000 + player), releaseAt: null };
}

/** Perfect になる溜めの tick（20〜40 の中） */
const PERFECT_CHARGES = [23, 24, 39, 40];
const OTHER_CHARGES = Array.from({ length: 21 }, (_, i) => i + 20).filter((c) => !PERFECT_CHARGES.includes(c));

function cursedOrDead(u: UnitState): boolean {
  return !isAlive(u) || u.curse !== null;
}

/** この tick に CPU が出す入力 */
export function cpuThink(cpu: Cpu, s: BattleState): Input[] {
  const me = s.players[cpu.player];
  const enemy = s.players[1 - cpu.player];
  const out: Input[] = [];

  // つついている間はタップだけ（2 tick に1回）
  if (me.poke) {
    if (s.tick - me.poke.lastTapTick >= C.POKE_TAP_INTERVAL) {
      let cell = me.poke.weakCell;
      if (randInt(cpu.rng, 1000) >= cpu.params.pokeHitPermil) {
        const r = randInt(cpu.rng, C.POKE_CELLS - 1);
        cell = r >= me.poke.weakCell ? r + 1 : r;
      }
      out.push({ t: "pokeTap", cell });
    }
    return out;
  }

  // 構えている：決めた溜めで解放
  if (me.stance) {
    if (cpu.releaseAt === null) {
      cpu.releaseAt =
        randInt(cpu.rng, 1000) < cpu.params.perfectPermil
          ? PERFECT_CHARGES[randInt(cpu.rng, PERFECT_CHARGES.length)]
          : OTHER_CHARGES[randInt(cpu.rng, OTHER_CHARGES.length)];
    }
    if (s.tick - me.stance.startTick >= cpu.releaseAt) out.push({ t: "ultRelease" });
  } else {
    cpu.releaseAt = null;
  }

  const front = [0, 1, 2].map((pos) => me.units[me.wheel[pos]]);
  const back = [3, 4, 5].map((pos) => me.units[me.wheel[pos]]);
  const urgent = front.some(cursedOrDead) && back.some(isAlive);

  // 回転（構えている間は回さない）
  if (!me.stance && me.rotateCooldown === 0 && urgent) {
    const upCw = me.units[me.wheel[5]]; // cw で位置 0 に上がる
    const upCcw = me.units[me.wheel[3]]; // ccw で位置 2 に上がる
    const outCw = front[2];
    const outCcw = front[0];
    const okCw = !cursedOrDead(upCw);
    const okCcw = !cursedOrDead(upCcw);
    let dir: "cw" | "ccw" | null = null;
    if (okCw && okCcw) dir = cursedOrDead(outCcw) && !cursedOrDead(outCw) ? "ccw" : "cw";
    else if (okCw) dir = "cw";
    else if (okCcw) dir = "ccw";
    if (dir) out.push({ t: "rotate", dir });
  }

  // 浄化
  if (!me.purify) {
    for (let pos = 3; pos < 6; pos++) {
      const u = me.units[me.wheel[pos]];
      if (isAlive(u) && u.curse) {
        out.push({ t: "purify", allySlot: pos });
        break;
      }
    }
  }

  // 標的：敵の前衛で HP の割合が一番低いユニット
  let low: UnitState | null = null;
  for (const u of aliveFront(enemy)) if (!low || hpRatio(u) < hpRatio(low)) low = u;
  if (low && me.targetCooldown === 0 && me.target !== low.index) out.push({ t: "target", enemyUnit: low.index });

  // 奥義
  let startedUlt = false;
  if (!me.stance && aliveFront(enemy).length > 0) {
    for (let pos = 0; pos < 3; pos++) {
      const u = me.units[me.wheel[pos]];
      if (!isAlive(u) || u.sg < C.SG_FULL || u.ultLockout > 0) continue;
      const l = me.units[me.wheel[(pos + 5) % 6]];
      const r = me.units[me.wheel[(pos + 1) % 6]];
      const grandOk = isAlive(l) && isAlive(r) && l.sg >= C.SG_FULL && r.sg >= C.SG_FULL;
      const grand = grandOk && randInt(cpu.rng, 1000) < cpu.params.grandPermil;
      out.push({ t: "ultStart", allySlot: pos, grand });
      startedUlt = true;
      break;
    }
  }

  // つつき：急ぎの用事がなく、構えてもいなければ
  if (!me.stance && !startedUlt && !urgent && me.pokeCooldown === 0) {
    for (const t of aliveFront(enemy)) {
      if (t.curse && isFront(enemy, t.index)) {
        out.push({ t: "pokeStart", enemyUnit: t.index });
        break;
      }
    }
  }
  return out;
}
