// ユニット・性格・装備のデータ（UNITS.md・BATTLE_SPEC §4.2・§7.2・§8.3）。

import { GENERATED_UNITS } from "./roster.gen.js";

export type Element = "fire" | "water" | "thunder" | "earth" | "ice" | "wind";
export type Tribe =
  | "takeru" // 猛
  | "ayashi" // 怪
  | "tsuwamono" // 剛
  | "kage" // 影
  | "nagomi" // 和
  | "miyabi" // 雅
  | "tatari" // 祟
  | "shizume" // 鎮
  | "maga"; // 禍（原作の怪魔に当たる特別な枠。陣はない）
/** 原作と同じ6段階 */
export type Rank = "S" | "A" | "B" | "C" | "D" | "E";

export type CurseKind = "slow" | "weaken" | "brittle" | "poison" | "seal" | "stun" | "confuse";
// 鈍重・衰弱・脆化・蝕毒・封気・行動停止・混乱
export type BlessingKind = "rally" | "fortify" | "haste" | "gather" | "regen" | "ward" | "allUp" | "taunt";
// 鼓舞・堅護・疾風・集気・再生・浄気・万全・挑発

/** 雅の陣が効くのはステータス低下系、祟の陣が効くのは状態異常系（§9） */
export const CURSE_CATEGORY: Record<CurseKind, "stat" | "status"> = {
  slow: "stat",
  weaken: "stat",
  brittle: "stat",
  poison: "status",
  seal: "status",
  stun: "status",
  confuse: "status",
};

export type StatKey = "atk" | "spa";

/** power を省くと constants の既定値（単体 150・全体 130・ガード崩し 130） */
export type UltDef =
  | { kind: "single"; stat: StatKey; element: Element | null; power?: number }
  | { kind: "all"; stat: StatKey; element: Element | null; power?: number }
  | { kind: "break"; stat: StatKey; element: Element | null; power?: number }
  | { kind: "heal" }
  | { kind: "curseAll"; curse: CurseKind }
  | { kind: "blessAll"; blessing: BlessingKind };

/** 特性（§8.5） */
export type TraitId =
  | "guardBreak" // 破甲
  | "keystone" // 要石
  | "fireAdept" // 火の心得
  | "waterAdept" // 水の心得
  | "thunderAdept" // 雷の心得
  | "earthAdept" // 土の心得
  | "iceAdept" // 氷の心得
  | "windAdept" // 風の心得
  | "endure" // 踏ん張り
  | "tailwind" // 追い風
  | "devour" // 屍喰い
  | "grudge" // 怨念
  | "curseMaster" // 呪詛の才
  | "unbreakable" // 不屈
  | "thorns" // 毒の肌
  | "mirror" // 鏡返し
  | "rage" // 逆上
  | "ironGuard" // 鉄壁
  | "drain" // 吸精
  | "waterEater" // 水喰い
  | "hidden" // 隠れ身
  | "firstStrike" // 先駆け
  | "spiritSmoke" // 福の気
  | "prayer" // 祈り
  | "benchHeal" // 後見
  | "conqueror" // 勝ち鬨
  | "critEye" // 一閃
  | "ultEvade" // 見切り
  | "doubleEndure" // 二度の踏ん張り
  | "scapegoat" // 身代わり頼み
  | "guardian"; // かばい手

export const TRAIT_NAMES: Record<TraitId, string> = {
  guardBreak: "破甲",
  keystone: "要石",
  fireAdept: "火の心得",
  waterAdept: "水の心得",
  thunderAdept: "雷の心得",
  earthAdept: "土の心得",
  iceAdept: "氷の心得",
  windAdept: "風の心得",
  endure: "踏ん張り",
  tailwind: "追い風",
  devour: "屍喰い",
  grudge: "怨念",
  curseMaster: "呪詛の才",
  unbreakable: "不屈",
  thorns: "毒の肌",
  mirror: "鏡返し",
  rage: "逆上",
  ironGuard: "鉄壁",
  drain: "吸精",
  waterEater: "水喰い",
  hidden: "隠れ身",
  firstStrike: "先駆け",
  spiritSmoke: "福の気",
  prayer: "祈り",
  benchHeal: "後見",
  conqueror: "勝ち鬨",
  critEye: "一閃",
  ultEvade: "見切り",
  doubleEndure: "二度の踏ん張り",
  scapegoat: "身代わり頼み",
  guardian: "かばい手",
};

/** 「〇の心得」の特性が強くする属性 */
export const ADEPT_ELEMENT: Partial<Record<TraitId, Element>> = {
  fireAdept: "fire",
  waterAdept: "water",
  thunderAdept: "thunder",
  earthAdept: "earth",
  iceAdept: "ice",
  windAdept: "wind",
};

/** グループ制限（§2.2）。同じグループからはチームに limit 体まで */
export type GroupId = "ogre";
export const GROUP_LIMITS: Record<GroupId, { name: string; limit: number }> = {
  ogre: { name: "大物", limit: 1 },
};

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
  /** 通常攻撃の威力（原作の技レベル MAX に合わせる。45〜150） */
  attackPower: number;
  skillElement: Element;
  /** 術の威力（90・110・120） */
  skillPower: number;
  curse: CurseKind;
  blessing: BlessingKind;
  ult: UltDef;
  ultName: string;
  /** なまけやすさ（‰） */
  loafPermil: number;
  defaultNature: NatureId;
  trait: TraitId;
  group?: GroupId;
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

// ---- ユニット（UNITS.md v0.3） ----
const LOAF = 25; // 2.5%（仮。全員同じ）

/** 手作りの 24 体（UNITS.md の表） */
const HANDMADE: readonly UnitDef[] = [
  {
    id: "oni", name: "鬼", rank: "S", tribe: "takeru",
    hp: 312, atk: 135, spa: 60, def: 95, spd: 60, sgRank: 2, weak: "ice", resist: "fire",
    skillElement: "fire", attackPower: 135, skillPower: 120, curse: "weaken", blessing: "rally",
    ult: { kind: "break", stat: "atk", element: null }, ultName: "金棒砕き",
    loafPermil: LOAF, defaultNature: "fierce", trait: "rage",
  },
  {
    id: "karakasa", name: "唐傘お化け", rank: "B", tribe: "takeru",
    hp: 258, atk: 115, spa: 70, def: 90, spd: 105, sgRank: 4, weak: "fire", resist: "water",
    skillElement: "water", attackPower: 90, skillPower: 90, curse: "brittle", blessing: "fortify",
    ult: { kind: "all", stat: "atk", element: "water" }, ultName: "傘回し",
    loafPermil: LOAF, defaultNature: "wild", trait: "ironGuard",
  },
  {
    id: "yukionna", name: "雪女", rank: "A", tribe: "ayashi",
    hp: 216, atk: 60, spa: 140, def: 75, spd: 100, sgRank: 3, weak: "fire", resist: "ice",
    skillElement: "ice", attackPower: 45, skillPower: 120, curse: "seal", blessing: "gather",
    ult: { kind: "single", stat: "spa", element: "ice" }, ultName: "氷華",
    loafPermil: LOAF, defaultNature: "arcane", trait: "iceAdept",
  },
  {
    id: "nekomata", name: "猫又", rank: "A", tribe: "ayashi",
    hp: 234, atk: 85, spa: 125, def: 75, spd: 110, sgRank: 4, weak: "water", resist: "thunder",
    skillElement: "thunder", attackPower: 67, skillPower: 120, curse: "poison", blessing: "haste",
    ult: { kind: "all", stat: "spa", element: "thunder" }, ultName: "二股雷",
    loafPermil: LOAF, defaultNature: "arcane", trait: "drain",
  },
  {
    id: "kappa", name: "河童", rank: "A", tribe: "tsuwamono",
    hp: 336, atk: 80, spa: 85, def: 130, spd: 65, sgRank: 3, weak: "thunder", resist: "fire",
    skillElement: "water", attackPower: 90, skillPower: 110, curse: "slow", blessing: "regen",
    ult: { kind: "heal" }, ultName: "皿の水",
    loafPermil: LOAF, defaultNature: "stalwart", trait: "waterEater",
  },
  {
    id: "ogama", name: "大蝦蟇", rank: "B", tribe: "tsuwamono",
    hp: 360, atk: 100, spa: 90, def: 110, spd: 50, sgRank: 2, weak: "thunder", resist: "water",
    skillElement: "water", attackPower: 90, skillPower: 120, curse: "poison", blessing: "fortify",
    ult: { kind: "all", stat: "spa", element: "water" }, ultName: "大毒霧",
    loafPermil: LOAF, defaultNature: "stalwart", trait: "thorns",
  },
  {
    id: "bakedanuki", name: "化け狸", rank: "B", tribe: "miyabi",
    hp: 282, atk: 90, spa: 95, def: 100, spd: 80, sgRank: 5, weak: "ice", resist: "earth",
    skillElement: "earth", attackPower: 67, skillPower: 110, curse: "slow", blessing: "gather",
    ult: { kind: "curseAll", curse: "slow" }, ultName: "大化かし",
    loafPermil: LOAF, defaultNature: "hinder", trait: "hidden",
  },
  {
    id: "rokurokubi", name: "ろくろ首", rank: "B", tribe: "miyabi",
    hp: 270, atk: 75, spa: 105, def: 95, spd: 85, sgRank: 6, weak: "earth", resist: "wind",
    skillElement: "thunder", attackPower: 67, skillPower: 110, curse: "weaken", blessing: "ward",
    ult: { kind: "single", stat: "spa", element: "thunder" }, ultName: "伸び噛み",
    loafPermil: LOAF, defaultNature: "hinder", trait: "firstStrike",
  },
  {
    id: "zashiki", name: "座敷童子", rank: "B", tribe: "nagomi",
    hp: 240, atk: 60, spa: 115, def: 90, spd: 95, sgRank: 6, weak: "wind", resist: null,
    skillElement: "earth", attackPower: 45, skillPower: 90, curse: "seal", blessing: "rally",
    ult: { kind: "blessAll", blessing: "rally" }, ultName: "福招き",
    loafPermil: LOAF, defaultNature: "devoted", trait: "spiritSmoke",
  },
  {
    id: "kodama", name: "木霊", rank: "B", tribe: "nagomi",
    hp: 252, atk: 55, spa: 110, def: 100, spd: 85, sgRank: 5, weak: "fire", resist: "earth",
    skillElement: "earth", attackPower: 45, skillPower: 90, curse: "slow", blessing: "regen",
    ult: { kind: "heal" }, ultName: "森の息吹",
    loafPermil: LOAF, defaultNature: "devoted", trait: "prayer",
  },
  {
    id: "tengu", name: "天狗", rank: "S", tribe: "kage",
    hp: 228, atk: 95, spa: 110, def: 70, spd: 135, sgRank: 4, weak: "thunder", resist: "wind",
    skillElement: "wind", attackPower: 120, skillPower: 110, curse: "brittle", blessing: "haste",
    ult: { kind: "all", stat: "spa", element: "wind" }, ultName: "大団扇",
    loafPermil: LOAF, defaultNature: "balanced", trait: "critEye",
  },
  {
    id: "kamaitachi", name: "鎌鼬", rank: "A", tribe: "kage",
    hp: 204, atk: 125, spa: 70, def: 65, spd: 140, sgRank: 5, weak: "earth", resist: "wind",
    skillElement: "wind", attackPower: 132, skillPower: 90, curse: "brittle", blessing: "rally",
    ult: { kind: "single", stat: "atk", element: "wind" }, ultName: "三連斬",
    loafPermil: LOAF, defaultNature: "fierce", trait: "conqueror",
  },
  // ---- v0.3 で追加（大物・祟・鎮ほか） ----
  {
    id: "shuten", name: "酒呑童子", rank: "S", tribe: "takeru", group: "ogre",
    hp: 438, atk: 200, spa: 90, def: 114, spd: 145, sgRank: 2, weak: "ice", resist: "fire",
    skillElement: "fire", attackPower: 112, skillPower: 120, curse: "weaken", blessing: "rally",
    ult: { kind: "single", stat: "atk", element: "fire", power: 350 }, ultName: "大盃砕き",
    loafPermil: LOAF, defaultNature: "fierce", trait: "guardBreak",
  },
  {
    id: "ushioni", name: "牛鬼", rank: "S", tribe: "tsuwamono", group: "ogre",
    hp: 456, atk: 177, spa: 81, def: 189, spd: 98, sgRank: 2, weak: "thunder", resist: "water",
    skillElement: "earth", attackPower: 112, skillPower: 120, curse: "brittle", blessing: "fortify",
    ult: { kind: "single", stat: "atk", element: null, power: 350 }, ultName: "牛角突き",
    loafPermil: LOAF, defaultNature: "stalwart", trait: "keystone",
  },
  {
    id: "otakemaru", name: "大嶽丸", rank: "S", tribe: "ayashi", group: "ogre",
    hp: 436, atk: 115, spa: 183, def: 121, spd: 142, sgRank: 2, weak: "earth", resist: "thunder",
    skillElement: "thunder", attackPower: 112, skillPower: 120, curse: "weaken", blessing: "rally",
    ult: { kind: "single", stat: "spa", element: "thunder", power: 350 }, ultName: "神通力",
    loafPermil: LOAF, defaultNature: "arcane", trait: "thunderAdept",
  },
  {
    id: "nurikabe", name: "ぬりかべ", rank: "B", tribe: "tsuwamono",
    hp: 300, atk: 60, spa: 50, def: 160, spd: 40, sgRank: 3, weak: "water", resist: "earth",
    skillElement: "earth", attackPower: 90, skillPower: 90, curse: "slow", blessing: "fortify",
    ult: { kind: "blessAll", blessing: "fortify" }, ultName: "通せんぼ",
    loafPermil: LOAF, defaultNature: "stalwart", trait: "endure",
  },
  {
    id: "ittan", name: "一反木綿", rank: "B", tribe: "kage",
    hp: 230, atk: 80, spa: 90, def: 70, spd: 150, sgRank: 5, weak: "fire", resist: "wind",
    skillElement: "wind", attackPower: 67, skillPower: 90, curse: "slow", blessing: "haste",
    ult: { kind: "blessAll", blessing: "haste" }, ultName: "巻き上げ",
    loafPermil: LOAF, defaultNature: "devoted", trait: "tailwind",
  },
  {
    id: "onibi", name: "鬼火", rank: "B", tribe: "ayashi",
    hp: 220, atk: 50, spa: 130, def: 65, spd: 105, sgRank: 4, weak: "water", resist: "fire",
    skillElement: "fire", attackPower: 45, skillPower: 120, curse: "weaken", blessing: "rally",
    ult: { kind: "all", stat: "spa", element: "fire" }, ultName: "百鬼の灯",
    loafPermil: LOAF, defaultNature: "arcane", trait: "fireAdept",
  },
  {
    id: "kasha", name: "火車", rank: "A", tribe: "tatari",
    hp: 300, atk: 150, spa: 80, def: 95, spd: 115, sgRank: 3, weak: "water", resist: "fire",
    skillElement: "fire", attackPower: 120, skillPower: 110, curse: "poison", blessing: "rally",
    ult: { kind: "single", stat: "atk", element: "fire" }, ultName: "亡者さらい",
    loafPermil: LOAF, defaultNature: "fierce", trait: "devour",
  },
  {
    id: "kyokotsu", name: "狂骨", rank: "B", tribe: "tatari",
    hp: 250, atk: 95, spa: 100, def: 80, spd: 90, sgRank: 5, weak: "fire", resist: "ice",
    skillElement: "ice", attackPower: 67, skillPower: 110, curse: "poison", blessing: "ward",
    ult: { kind: "curseAll", curse: "poison" }, ultName: "井戸の底",
    loafPermil: LOAF, defaultNature: "hinder", trait: "grudge",
  },
  {
    id: "waira", name: "わいら", rank: "B", tribe: "tatari",
    hp: 270, atk: 100, spa: 85, def: 100, spd: 75, sgRank: 4, weak: "wind", resist: "earth",
    skillElement: "earth", attackPower: 90, skillPower: 110, curse: "seal", blessing: "gather",
    ult: { kind: "all", stat: "atk", element: "earth" }, ultName: "土かき",
    loafPermil: LOAF, defaultNature: "hinder", trait: "curseMaster",
  },
  {
    id: "komainu", name: "狛犬", rank: "B", tribe: "shizume",
    hp: 290, atk: 105, spa: 70, def: 120, spd: 95, sgRank: 4, weak: "thunder", resist: "earth",
    skillElement: "earth", attackPower: 90, skillPower: 90, curse: "brittle", blessing: "ward",
    ult: { kind: "break", stat: "atk", element: null }, ultName: "阿吽の牙",
    loafPermil: LOAF, defaultNature: "balanced", trait: "unbreakable",
  },
  {
    id: "yamabiko", name: "山彦", rank: "B", tribe: "shizume",
    hp: 260, atk: 70, spa: 110, def: 105, spd: 90, sgRank: 5, weak: "earth", resist: "wind",
    skillElement: "wind", attackPower: 45, skillPower: 110, curse: "weaken", blessing: "regen",
    ult: { kind: "heal" }, ultName: "こだまの声",
    loafPermil: LOAF, defaultNature: "careful", trait: "mirror",
  },
  {
    id: "hakutaku", name: "白澤", rank: "A", tribe: "shizume",
    hp: 280, atk: 60, spa: 135, def: 110, spd: 100, sgRank: 4, weak: "fire", resist: "thunder",
    skillElement: "thunder", attackPower: 45, skillPower: 110, curse: "seal", blessing: "ward",
    ult: { kind: "heal" }, ultName: "瑞獣の知恵",
    loafPermil: LOAF, defaultNature: "devoted", trait: "benchHeal",
  },
];

/** 全ユニット：手作りの 24 体 ＋ 原作と同じ数にそろえるための 372 体（scripts/gen-roster.mjs） */
export const UNITS: readonly UnitDef[] = [...HANDMADE, ...GENERATED_UNITS];

export function unitIndexById(id: string): number {
  const i = UNITS.findIndex((u) => u.id === id);
  if (i < 0) throw new Error(`unknown unit ${id}`);
  return i;
}
