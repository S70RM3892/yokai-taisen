// 戦闘の状態（BATTLE_SPEC §3〜§12）。
// 状態は数値・配列・プレーンなオブジェクトだけで持つ（そのまま複製・比較・保存できるように）。

import { AG_START_FRONT, SG_START, TEAM_SIZE } from "./constants.js";
import type { ActionKind, BlessingKind, CurseKind, EquipmentId, NatureId } from "./data.js";
import { createStream, type RngState } from "./rng.js";
import { RNG_STREAM_POKE_BASE } from "./constants.js";
import { buildMember, type TeamSpec, validateTeam } from "./team.js";

export type PlayerId = 0 | 1;

export interface CurseState {
  kind: CurseKind;
  /** 0 = 大, 1 = 超, 2 = 究極 */
  tier: number;
  remaining: number;
  /** かかってから進んだ tick（蝕毒の間隔を数える） */
  elapsed: number;
}

export interface BlessingState {
  kind: BlessingKind;
  tier: number;
  remaining: number;
  elapsed: number;
  /** 浄気：新しい呪付をあと何回防ぐか */
  wardCharges: number;
}

export interface UnitState {
  /** 0〜11（P1 が 0〜5、P2 が 6〜11）。乱数の流れの番号と同じ */
  uid: number;
  owner: PlayerId;
  /** チームの中のユニット番号 0〜5 */
  index: number;
  defIndex: number;
  nature: NatureId;
  equipment: EquipmentId | null;
  maxHp: number;
  atk: number;
  spa: number;
  def: number;
  spd: number;
  hp: number;
  ag: number;
  sg: number;
  guarding: boolean;
  loafing: boolean;
  curse: CurseState | null;
  blessing: BlessingState | null;
  /** 再構え制限の残り tick */
  ultLockout: number;
  dollUsed: boolean;
  /** 敵がいなくて待っている行動（§12.2） */
  pendingAction: ActionKind | null;
  rng: RngState;
}

export interface StanceState {
  /** 構えているユニットのユニット番号 */
  unit: number;
  startTick: number;
  grand: boolean;
  /** 大奥義で妖気を使う両隣のユニット番号 */
  partners: number[];
  /** この tick の手順 2 で解放する */
  releaseRequested: boolean;
}

export interface PokeState {
  /** 相手のユニット番号 */
  target: number;
  elapsed: number;
  gauge: number;
  weakCell: number;
  lastTapTick: number;
}

export interface PlayerState {
  /** wheel[位置] = ユニット番号。0〜2 が前衛 */
  wheel: number[];
  units: UnitState[];
  rotateCooldown: number;
  target: number | null;
  targetCooldown: number;
  purify: { unit: number; progress: number } | null;
  stance: StanceState | null;
  poke: PokeState | null;
  pokeCooldown: number;
  pokeRng: RngState;
}

export type Outcome = { winner: PlayerId | null; reason: "ko" | "time" };

export interface BattleState {
  tick: number;
  seed: number;
  players: [PlayerState, PlayerState];
  outcome: Outcome | null;
}

/** 試合を始める。編成が正しくなければ例外を投げる */
export function createBattle(seed: number, team0: TeamSpec, team1: TeamSpec): BattleState {
  const teams = [team0, team1];
  const players = teams.map((team, p) => {
    const errors = validateTeam(team);
    if (errors.length > 0) throw new Error(`P${p + 1} の編成が正しくない: ${errors.join(" / ")}`);
    const units: UnitState[] = team.map((m, i) => {
      const b = buildMember(m);
      const uid = p * TEAM_SIZE + i;
      return {
        uid,
        owner: p as PlayerId,
        index: i,
        defIndex: b.defIndex,
        nature: b.nature,
        equipment: b.equipment,
        maxHp: b.maxHp,
        atk: b.atk,
        spa: b.spa,
        def: b.def,
        spd: b.spd,
        hp: b.maxHp,
        ag: i < 3 ? AG_START_FRONT : 0,
        sg: SG_START,
        guarding: false,
        loafing: false,
        curse: null,
        blessing: null,
        ultLockout: 0,
        dollUsed: false,
        pendingAction: null,
        rng: createStream(seed, uid),
      };
    });
    const ps: PlayerState = {
      wheel: [0, 1, 2, 3, 4, 5],
      units,
      rotateCooldown: 0,
      target: null,
      targetCooldown: 0,
      purify: null,
      stance: null,
      poke: null,
      pokeCooldown: 0,
      pokeRng: createStream(seed, RNG_STREAM_POKE_BASE + p),
    };
    return ps;
  });
  return { tick: 0, seed: seed >>> 0, players: players as [PlayerState, PlayerState], outcome: null };
}

// ---- 状態を読むための小さな関数 ----

export function positionOf(p: PlayerState, unitIndex: number): number {
  return p.wheel.indexOf(unitIndex);
}

export function isFront(p: PlayerState, unitIndex: number): boolean {
  return positionOf(p, unitIndex) < 3;
}

export function isAlive(u: UnitState): boolean {
  return u.hp > 0;
}

/** 前衛のユニット（位置 0→2 の順。戦闘不能も含む） */
export function frontUnits(p: PlayerState): UnitState[] {
  return [p.units[p.wheel[0]], p.units[p.wheel[1]], p.units[p.wheel[2]]];
}

export function aliveFront(p: PlayerState): UnitState[] {
  return frontUnits(p).filter(isAlive);
}

/** HP の割合（‰、§12.6） */
export function hpRatio(u: UnitState): number {
  return Math.floor((u.hp * 1000) / u.maxHp);
}
