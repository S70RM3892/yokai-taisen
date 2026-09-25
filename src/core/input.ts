// プレイヤーの入力（BATTLE_SPEC §11）。

import type { PlayerId } from "./state.js";

export type Input =
  | { t: "rotate"; dir: "cw" | "ccw" }
  /** 位置ではなくユニット番号（回しても付いていく） */
  | { t: "target"; enemyUnit: number }
  /** 前衛の位置 0〜2。grand = true なら大奥義 */
  | { t: "ultStart"; allySlot: number; grand: boolean }
  | { t: "ultRelease" }
  | { t: "ultCancel" }
  /** 後衛の位置 3〜5 */
  | { t: "purify"; allySlot: number }
  | { t: "pokeStart"; enemyUnit: number }
  /** 0〜15（4×4 のマス。左上が 0） */
  | { t: "pokeTap"; cell: number }
  | { t: "pokeStop" };

export interface PlayerInput {
  player: PlayerId;
  input: Input;
}

/** リプレイの1行 */
export interface InputRecord extends PlayerInput {
  tick: number;
}

/** §3 手順 1 の中での処理順：回転 → 標的 → 浄化 → 奥義 → つつき */
export function inputCategory(i: Input): number {
  switch (i.t) {
    case "rotate":
      return 0;
    case "target":
      return 1;
    case "purify":
      return 2;
    case "ultStart":
    case "ultRelease":
    case "ultCancel":
      return 3;
    case "pokeStart":
    case "pokeTap":
    case "pokeStop":
      return 4;
    default:
      return 99;
  }
}
