// ユニット・性格・装備のデータ（UNITS.md・BATTLE_SPEC §4.2・§7.2・§8.3）。

export type Element = "fire" | "water" | "thunder" | "earth" | "ice" | "wind";
export type Tribe =
  | "takeru" // 猛
  | "ayashi" // 怪
  | "tsuwamono" // 剛
  | "kage" // 影
  | "nagomi" // 和
  | "miyabi" // 雅
  | "tatari" // 祟
  | "shizume"; // 鎮
export type Rank = "S" | "A" | "B";

export type CurseKind = "slow" | "weaken" | "brittle" | "poison" | "seal";
// 鈍重・衰弱・脆化・蝕毒・封気
export type BlessingKind = "rally" | "fortify" | "haste" | "gather" | "regen" | "ward";
// 鼓舞・堅護・疾風・集気・再生・浄気

/** 雅の陣が効くのはステータス低下系、祟の陣が効くのは状態異常系（§9） */
export const CURSE_CATEGORY: Record<CurseKind, "stat" | "status"> = {
  slow: "stat",
  weaken: "stat",
  brittle: "stat",
  poison: "status",
  seal: "status",
};

export type StatKey = "atk" | "spa";

export type UltDef =
  | { kind: "single"; stat: StatKey; element: Element | null }
  | { kind: "all"; stat: StatKey; element: Element | null }
  | { kind: "break"; stat: StatKey; element: Element | null }
  | { kind: "heal" }
  | { kind: "curseAll"; curse: CurseKind }
  | { kind: "blessAll"; blessing: BlessingKind };

export interface UnitDef {
  id: string;
  name: string;
  rank: Rank;
  tribe: Tribe;
  hp: number;
  atk: number;
  spa: number;
  def: number;
  spd: number;
  /** 妖気速度ランク 1〜6 */
  sgRank: number;
  weak: Element | null;
  resist: Element | null;
  skillElement: Element;
  skillPower: number;
  curse: CurseKind;
  blessing: BlessingKind;
  ult: UltDef;
  ultName: string;
  /** なまけやすさ（‰） */
  loafPermil: number;
  defaultNature: NatureId;
}

// ---- 性格（§4.2）。確率は % で、合計 100 ----
export type NatureId =
  | "fierce" // 猛攻
  | "arcane" // 術重
  | "balanced" // 均衡
  | "wild" // 奔放
  | "hinder" // 妨害
  | "devoted" // 献身
  | "stalwart" // 堅守
  | "careful"; // 慎重

export type ActionKind = "attack" | "skill" | "guard" | "curse" | "bless";
/** 抽選するときの行動の順番（この順に確率を足していく） */
export const ACTION_ORDER: readonly ActionKind[] = ["attack", "skill", "guard", "curse", "bless"];

export interface NatureDef {
  id: NatureId;
  name: string;
  /** ACTION_ORDER の順の確率（%） */
  weights: readonly [number, number, number, number, number];
}

export const NATURES: readonly NatureDef[] = [
  { id: "fierce", name: "猛攻", weights: [80, 20, 0, 0, 0] },
  { id: "arcane", name: "術重", weights: [20, 60, 0, 10, 10] },
  { id: "balanced", name: "均衡", weights: [30, 20, 20, 20, 10] },
  { id: "wild", name: "奔放", weights: [40, 40, 0, 10, 10] },
  { id: "hinder", name: "妨害", weights: [20, 20, 10, 40, 10] },
  { id: "devoted", name: "献身", weights: [0, 30, 20, 10, 40] },
  { id: "stalwart", name: "堅守", weights: [20, 20, 40, 10, 10] },
  { id: "careful", name: "慎重", weights: [30, 30, 30, 0, 10] },
];

export function natureById(id: NatureId): NatureDef {
  const n = NATURES.find((x) => x.id === id);
  if (!n) throw new Error(`unknown nature ${id}`);
  return n;
}

// ---- 装備（§8.3） ----
export type EquipmentId =
  | "power_bangle" // 剛力の腕輪
  | "spirit_bangle" // 妖力の腕輪
  | "iron_beads" // 鉄の数珠
  | "swift_geta" // 韋駄天の下駄
  | "life_jewel" // 命の勾玉
  | "spirit_bell" // 妖気の鈴
  | "ward_charm" // 厄除けの守り
  | "stand_in_doll" // 身代わり人形
  | "diligence_band"; // 精勤の鉢巻

export const EQUIPMENT: readonly { id: EquipmentId; name: string }[] = [
  { id: "power_bangle", name: "剛力の腕輪" },
  { id: "spirit_bangle", name: "妖力の腕輪" },
  { id: "iron_beads", name: "鉄の数珠" },
  { id: "swift_geta", name: "韋駄天の下駄" },
  { id: "life_jewel", name: "命の勾玉" },
  { id: "spirit_bell", name: "妖気の鈴" },
  { id: "ward_charm", name: "厄除けの守り" },
  { id: "stand_in_doll", name: "身代わり人形" },
  { id: "diligence_band", name: "精勤の鉢巻" },
];

// ---- ユニット（UNITS.md v0.1） ----
const LOAF = 25; // 2.5%（仮。全員同じ）

export const UNITS: readonly UnitDef[] = [
  {
    id: "oni", name: "鬼", rank: "S", tribe: "takeru",
    hp: 520, atk: 135, spa: 60, def: 95, spd: 60, sgRank: 2, weak: "ice", resist: "fire",
    skillElement: "fire", skillPower: 45, curse: "weaken", blessing: "rally",
    ult: { kind: "break", stat: "atk", element: null }, ultName: "金棒砕き",
    loafPermil: LOAF, defaultNature: "fierce",
  },
  {
    id: "karakasa", name: "唐傘お化け", rank: "B", tribe: "takeru",
    hp: 430, atk: 115, spa: 70, def: 90, spd: 105, sgRank: 4, weak: "fire", resist: "water",
    skillElement: "water", skillPower: 35, curse: "brittle", blessing: "fortify",
    ult: { kind: "all", stat: "atk", element: "water" }, ultName: "傘回し",
    loafPermil: LOAF, defaultNature: "wild",
  },
  {
    id: "yukionna", name: "雪女", rank: "A", tribe: "ayashi",
    hp: 360, atk: 60, spa: 140, def: 75, spd: 100, sgRank: 3, weak: "fire", resist: "ice",
    skillElement: "ice", skillPower: 50, curse: "seal", blessing: "gather",
    ult: { kind: "single", stat: "spa", element: "ice" }, ultName: "氷華",
    loafPermil: LOAF, defaultNature: "arcane",
  },
  {
    id: "nekomata", name: "猫又", rank: "A", tribe: "ayashi",
    hp: 390, atk: 85, spa: 125, def: 75, spd: 110, sgRank: 4, weak: "water", resist: "thunder",
    skillElement: "thunder", skillPower: 45, curse: "poison", blessing: "haste",
    ult: { kind: "all", stat: "spa", element: "thunder" }, ultName: "二股雷",
    loafPermil: LOAF, defaultNature: "arcane",
  },
  {
    id: "kappa", name: "河童", rank: "A", tribe: "tsuwamono",
    hp: 560, atk: 80, spa: 85, def: 130, spd: 65, sgRank: 3, weak: "thunder", resist: "fire",
    skillElement: "water", skillPower: 40, curse: "slow", blessing: "regen",
    ult: { kind: "heal" }, ultName: "皿の水",
    loafPermil: LOAF, defaultNature: "stalwart",
  },
  {
    id: "ogama", name: "大蝦蟇", rank: "B", tribe: "tsuwamono",
    hp: 600, atk: 100, spa: 90, def: 110, spd: 50, sgRank: 2, weak: "thunder", resist: "water",
    skillElement: "water", skillPower: 45, curse: "poison", blessing: "fortify",
    ult: { kind: "all", stat: "spa", element: "water" }, ultName: "大毒霧",
    loafPermil: LOAF, defaultNature: "stalwart",
  },
  {
    id: "bakedanuki", name: "化け狸", rank: "B", tribe: "miyabi",
    hp: 470, atk: 90, spa: 95, def: 100, spd: 80, sgRank: 5, weak: "ice", resist: "earth",
    skillElement: "earth", skillPower: 40, curse: "slow", blessing: "gather",
    ult: { kind: "curseAll", curse: "slow" }, ultName: "大化かし",
    loafPermil: LOAF, defaultNature: "hinder",
  },
  {
    id: "rokurokubi", name: "ろくろ首", rank: "B", tribe: "miyabi",
    hp: 450, atk: 75, spa: 105, def: 95, spd: 85, sgRank: 6, weak: "earth", resist: "wind",
    skillElement: "thunder", skillPower: 40, curse: "weaken", blessing: "ward",
    ult: { kind: "single", stat: "spa", element: "thunder" }, ultName: "伸び噛み",
    loafPermil: LOAF, defaultNature: "hinder",
  },
  {
    id: "zashiki", name: "座敷童子", rank: "B", tribe: "nagomi",
    hp: 400, atk: 60, spa: 115, def: 90, spd: 95, sgRank: 6, weak: "wind", resist: null,
    skillElement: "earth", skillPower: 35, curse: "seal", blessing: "rally",
    ult: { kind: "blessAll", blessing: "rally" }, ultName: "福招き",
    loafPermil: LOAF, defaultNature: "devoted",
  },
  {
    id: "kodama", name: "木霊", rank: "B", tribe: "nagomi",
    hp: 420, atk: 55, spa: 110, def: 100, spd: 85, sgRank: 5, weak: "fire", resist: "earth",
    skillElement: "earth", skillPower: 35, curse: "slow", blessing: "regen",
    ult: { kind: "heal" }, ultName: "森の息吹",
    loafPermil: LOAF, defaultNature: "devoted",
  },
  {
    id: "tengu", name: "天狗", rank: "S", tribe: "kage",
    hp: 380, atk: 95, spa: 110, def: 70, spd: 135, sgRank: 4, weak: "thunder", resist: "wind",
    skillElement: "wind", skillPower: 40, curse: "brittle", blessing: "haste",
    ult: { kind: "all", stat: "spa", element: "wind" }, ultName: "大団扇",
    loafPermil: LOAF, defaultNature: "balanced",
  },
  {
    id: "kamaitachi", name: "鎌鼬", rank: "A", tribe: "kage",
    hp: 340, atk: 125, spa: 70, def: 65, spd: 140, sgRank: 5, weak: "earth", resist: "wind",
    skillElement: "wind", skillPower: 35, curse: "brittle", blessing: "rally",
    ult: { kind: "single", stat: "atk", element: "wind" }, ultName: "三連斬",
    loafPermil: LOAF, defaultNature: "fierce",
  },
];

export function unitIndexById(id: string): number {
  const i = UNITS.findIndex((u) => u.id === id);
  if (i < 0) throw new Error(`unknown unit ${id}`);
  return i;
}
