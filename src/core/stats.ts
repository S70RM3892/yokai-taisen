// ステータスの計算（陣・呪付・加護）と、行動に必要な AG（BATTLE_SPEC §4.1・§9・§12.4）。

import * as C from "./constants.js";
import { type Tribe, UNITS } from "./data.js";
import { isAlive, isFront, positionOf, type PlayerState, type UnitState } from "./state.js";

export type StatName = "atk" | "spa" | "def" | "spd";

const STAT_TRIBE: Record<StatName, Tribe> = {
  atk: "takeru",
  spa: "ayashi",
  def: "tsuwamono",
  spd: "kage",
};

export function tribeOf(u: UnitState): Tribe {
  return UNITS[u.defIndex].tribe;
}

/** ホイールで隣り合って同じ種族がつながっている数（自分も含む。戦闘不能はつながりを切る） */
export function chainLength(p: PlayerState, u: UnitState): number {
  if (!isAlive(u)) return 0;
  const tribe = tribeOf(u);
  const pos = positionOf(p, u.index);
  const same = (q: number) => {
    const v = p.units[p.wheel[((q % 6) + 6) % 6]];
    return isAlive(v) && tribeOf(v) === tribe;
  };
  let right = 0;
  while (right < 5 && same(pos + right + 1)) right++;
  let left = 0;
  while (left < 5 - right && same(pos - left - 1)) left++;
  return 1 + right + left;
}

/**
 * そのユニットが受けている陣の強さ（‰）。tribe を渡すと、その種族の陣のときだけ返す（§9）。
 * 陣を受けるのは、つながっているユニットのうち前衛にいるものだけ。
 */
export function formationPermil(p: PlayerState, u: UnitState, tribe?: Tribe): number {
  if (!isFront(p, u.index)) return 0;
  if (tribe !== undefined && tribeOf(u) !== tribe) return 0;
  const n = chainLength(p, u);
  if (n >= 3) return C.FORMATION_PERMIL_3;
  if (n === 2) return C.FORMATION_PERMIL_2;
  return 0;
}

/** 陣・加護・呪付で増減したあとのステ（§12.4） */
export function effectiveStat(p: PlayerState, u: UnitState, stat: StatName): number {
  let permil = 1000 + formationPermil(p, u, STAT_TRIBE[stat]);
  const b = u.blessing;
  if (b) {
    if (
      (b.kind === "rally" && (stat === "atk" || stat === "spa")) ||
      (b.kind === "fortify" && stat === "def") ||
      (b.kind === "haste" && stat === "spd")
    ) {
      permil += C.TIER_STAT_PERMIL[b.tier];
    }
  }
  const c = u.curse;
  if (c) {
    if (
      (c.kind === "weaken" && (stat === "atk" || stat === "spa")) ||
      (c.kind === "brittle" && stat === "def") ||
      (c.kind === "slow" && stat === "spd")
    ) {
      permil -= C.TIER_STAT_PERMIL[c.tier];
    }
  }
  if (permil < C.STAT_MULT_MIN) permil = C.STAT_MULT_MIN;
  return Math.floor((u[stat] * permil) / 1000);
}

/** 次に行動するのに必要な AG（§4.1） */
export function agNeeded(p: PlayerState, u: UnitState): number {
  return C.actionPoints(effectiveStat(p, u, "spd")) * C.AG_PER_ACTION_POINT;
}
