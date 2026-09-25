// 編成（BATTLE_SPEC §2.1・§2.2・§8.3）。

import {
  EFFORT_HP_PER_POINT,
  EFFORT_MAX_PER_STAT,
  EFFORT_TOTAL,
  EQUIP_HP_BONUS,
  EQUIP_STAT_BONUS,
  RANK_LIMITS,
  TEAM_SIZE,
} from "./constants.js";
import { type EquipmentId, type NatureId, UNITS, unitIndexById, natureById, EQUIPMENT } from "./data.js";

export interface Effort {
  hp: number;
  atk: number;
  spa: number;
  def: number;
  spd: number;
}

export const NO_EFFORT: Effort = { hp: 0, atk: 0, spa: 0, def: 0, spd: 0 };

export interface MemberSpec {
  /** UnitDef.id */
  unit: string;
  nature?: NatureId;
  effort?: Effort;
  equipment?: EquipmentId | null;
}

/** 6体。並び順がそのまま最初のホイールの位置（0〜2 が前衛）とユニット番号になる */
export type TeamSpec = MemberSpec[];

/** 編成が正しいか調べる。問題があればその説明を返す（空なら OK） */
export function validateTeam(team: TeamSpec): string[] {
  const errors: string[] = [];
  if (team.length !== TEAM_SIZE) errors.push(`チームは ${TEAM_SIZE} 体（今は ${team.length} 体）`);
  const rankCount = { S: 0, A: 0, B: 0 };
  team.forEach((m, i) => {
    const def = UNITS.find((u) => u.id === m.unit);
    if (!def) {
      errors.push(`#${i}: 知らないユニット ${m.unit}`);
      return;
    }
    rankCount[def.rank]++;
    if (m.nature !== undefined) {
      try {
        natureById(m.nature);
      } catch {
        errors.push(`#${i}: 知らない性格 ${m.nature}`);
      }
    }
    if (m.equipment != null && !EQUIPMENT.some((e) => e.id === m.equipment)) {
      errors.push(`#${i}: 知らない装備 ${m.equipment}`);
    }
    const e = m.effort ?? NO_EFFORT;
    let sum = 0;
    for (const k of ["hp", "atk", "spa", "def", "spd"] as const) {
      const v = e[k];
      if (!Number.isInteger(v) || v < 0 || v > EFFORT_MAX_PER_STAT) {
        errors.push(`#${i}: 努力ポイント ${k} は 0〜${EFFORT_MAX_PER_STAT} の整数（今は ${v}）`);
      }
      sum += v;
    }
    if (sum > EFFORT_TOTAL) errors.push(`#${i}: 努力ポイントの合計は ${EFFORT_TOTAL} まで（今は ${sum}）`);
  });
  for (const r of ["S", "A", "B"] as const) {
    if (rankCount[r] > RANK_LIMITS[r]) {
      errors.push(`${r} ランクは ${RANK_LIMITS[r]} 体まで（今は ${rankCount[r]} 体）`);
    }
  }
  return errors;
}

export interface BuiltStats {
  defIndex: number;
  maxHp: number;
  atk: number;
  spa: number;
  def: number;
  spd: number;
  nature: NatureId;
  equipment: EquipmentId | null;
}

/** 素のステ + 努力ポイント + 装備（§2.1・§8.3） */
export function buildMember(m: MemberSpec): BuiltStats {
  const defIndex = unitIndexById(m.unit);
  const d = UNITS[defIndex];
  const e = m.effort ?? NO_EFFORT;
  const eq = m.equipment ?? null;
  return {
    defIndex,
    maxHp: d.hp + e.hp * EFFORT_HP_PER_POINT + (eq === "life_jewel" ? EQUIP_HP_BONUS : 0),
    atk: d.atk + e.atk + (eq === "power_bangle" ? EQUIP_STAT_BONUS : 0),
    spa: d.spa + e.spa + (eq === "spirit_bangle" ? EQUIP_STAT_BONUS : 0),
    def: d.def + e.def + (eq === "iron_beads" ? EQUIP_STAT_BONUS : 0),
    spd: d.spd + e.spd + (eq === "swift_geta" ? EQUIP_STAT_BONUS : 0),
    nature: m.nature ?? d.defaultNature,
    equipment: eq,
  };
}
