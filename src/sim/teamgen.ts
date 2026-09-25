// シミュレーター用のランダム編成。ランク制限（§2.2）を守る。

import { RANK_LIMITS } from "../core/constants.js";
import { EQUIPMENT, type EquipmentId, GROUP_LIMITS, type GroupId, NATURES, UNITS } from "../core/data.js";
import { randInt, type RngState } from "../core/rng.js";
import type { Effort, MemberSpec, TeamSpec } from "../core/team.js";

/** 努力ポイントの配分の型（合計 40） */
export const EFFORT_PRESETS: readonly { id: string; name: string; effort: Effort }[] = [
  { id: "atk_spd", name: "力・速", effort: { hp: 0, atk: 20, spa: 0, def: 0, spd: 20 } },
  { id: "spa_spd", name: "術・速", effort: { hp: 0, atk: 0, spa: 20, def: 0, spd: 20 } },
  { id: "hp_def", name: "体・守", effort: { hp: 20, atk: 0, spa: 0, def: 20, spd: 0 } },
  { id: "atk_def", name: "力・守", effort: { hp: 0, atk: 20, spa: 0, def: 20, spd: 0 } },
  { id: "spa_def", name: "術・守", effort: { hp: 0, atk: 0, spa: 20, def: 20, spd: 0 } },
  { id: "even", name: "均等", effort: { hp: 8, atk: 8, spa: 8, def: 8, spd: 8 } },
];

export interface GeneratedMember extends MemberSpec {
  effortPreset: string;
}

export function randomTeam(rng: RngState): GeneratedMember[] {
  const count = { S: 0, A: 0, B: 0 };
  const groups = new Map<GroupId, number>();
  const team: GeneratedMember[] = [];
  while (team.length < 6) {
    const def = UNITS[randInt(rng, UNITS.length)];
    if (count[def.rank] >= RANK_LIMITS[def.rank]) continue;
    if (def.group && (groups.get(def.group) ?? 0) >= GROUP_LIMITS[def.group].limit) continue;
    count[def.rank]++;
    if (def.group) groups.set(def.group, (groups.get(def.group) ?? 0) + 1);
    const preset = EFFORT_PRESETS[randInt(rng, EFFORT_PRESETS.length)];
    const eqIndex = randInt(rng, EQUIPMENT.length + 1);
    const equipment: EquipmentId | null = eqIndex === EQUIPMENT.length ? null : EQUIPMENT[eqIndex].id;
    team.push({
      unit: def.id,
      nature: NATURES[randInt(rng, NATURES.length)].id,
      effort: { ...preset.effort },
      equipment,
      effortPreset: preset.id,
    });
  }
  return team;
}

export function toTeamSpec(team: GeneratedMember[]): TeamSpec {
  return team.map(({ unit, nature, effort, equipment }) => ({ unit, nature, effort, equipment }));
}
