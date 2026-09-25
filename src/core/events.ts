// 1 tick の間に起きたこと。描画・ログ・集計はこれを見る（§9.2：演出は状態とイベントから作る）。

import type { ActionKind, BlessingKind, CurseKind } from "./data.js";
import type { Input } from "./input.js";
import type { Outcome, PlayerId } from "./state.js";

export type Quality = "perfect" | "good" | "miss";
export type DamageSource = "attack" | "skill" | "ult" | "poison" | "poke" | "trait";

export type BattleEvent =
  | { t: "dropped"; player: PlayerId; input: Input }
  | { t: "rotate"; player: PlayerId; dir: "cw" | "ccw"; steps: number }
  /** 前衛が全滅したときの強制回転（§12.2） */
  | { t: "forcedRotate"; player: PlayerId }
  /** サドンデスに入った（§10） */
  | { t: "suddenDeath" }
  | { t: "target"; player: PlayerId; enemyUnit: number }
  | { t: "action"; uid: number; action: ActionKind | "loaf" | "stunned" }
  /** 特性「見切り」で奥義をよけた */
  | { t: "evade"; uid: number }
  /** 特性「身代わり頼み」「かばい手」で、代わりに受けた */
  | { t: "cover"; from: number; to: number }
  | { t: "damage"; src: number | null; dst: number; amount: number; source: DamageSource; crit: boolean }
  | { t: "heal"; src: number | null; dst: number; amount: number }
  | { t: "curse"; src: number; dst: number; kind: CurseKind; tier: number; result: "hit" | "miss" | "warded" | "immune" }
  | { t: "bless"; src: number; dst: number; kind: BlessingKind; tier: number }
  | { t: "curseCleared"; uid: number; by: "purify" | "ward" | "expire" }
  | { t: "doll"; uid: number }
  /** 特性「踏ん張り」で耐えた */
  | { t: "endure"; uid: number }
  /** 特性「先駆け」ですぐに行動できるようになった */
  | { t: "firstStrike"; uid: number }
  | { t: "ko"; uid: number }
  | { t: "stance"; player: PlayerId; uid: number; grand: boolean }
  | { t: "stanceCancel"; player: PlayerId; uid: number; grand: boolean; reason: "input" | "rotate" | "ko" }
  | { t: "ult"; player: PlayerId; uid: number; grand: boolean; quality: Quality; charge: number; auto: boolean }
  | { t: "purifyStart"; player: PlayerId; uid: number }
  | { t: "pokeStart"; player: PlayerId; target: number }
  | { t: "pokeEnd"; player: PlayerId; target: number; result: "success" | "fail" | "stopped" }
  | { t: "end"; outcome: Outcome };
