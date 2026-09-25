// 戦闘の数値はすべてここにまとめる（BATTLE_SPEC.md 冒頭：数値は1か所の定数ファイルに）。
// 倍率は ‰（1000 = 1.0倍）。時間は tick（1 tick = 50ms）。

/** 1秒あたりの tick 数（§0） */
export const TICKS_PER_SEC = 20;

// ---- 行動ゲージ（§4.1） ----
/** 1 tick あたりの AG 増加（全員同じ）。行動に必要な AG = 行動ポイント × AG_PER_ACTION_POINT */
export const AG_PER_TICK = 9;
export const AG_PER_ACTION_POINT = 10;
/** 開始時の前衛の AG = 必要な量 × この範囲（‰）。原作の初期前衛補正 0.4〜0.6 倍 */
export const AG_START_FRONT_MIN = 400;
export const AG_START_FRONT_MAX = 600;

/** 【原作】行動後に入る行動ポイント（たくトンボ「育成の知識」） */
export function actionPoints(spd: number): number {
  if (spd <= 171) return 369 - Math.floor(spd / 3) * 3;
  if (spd <= 201) return 198 - Math.floor((spd - 171) / 5) * 3;
  if (spd <= 501) return 180 - Math.floor((spd - 201) / 10) * 3;
  return 90;
}

// ---- なまけ・クリティカル（§4.6） ----
/** 【原作】64 回に1回（約 1.56%）。なまけている相手には 4 倍 */
export const CRIT_DENOM = 64;
export const CRIT_CHANCE = 1;
export const CRIT_CHANCE_VS_LOAFING = 4;
/** 【原作】クリティカルは守りを無視して 1.5 倍 */
export const CRIT_MULT = 1500;

// ---- 行動（§4.3） ----
export const GUARD_MULT = 500;

// ---- ダメージ（§5） ----
export const VARIATION_MIN = 980;
export const VARIATION_MAX = 1020;
export const WEAK_MULT = 1500;
export const RESIST_MULT = 500;

// ---- 妖気ゲージ（§6.1） ----
export const SG_FULL = 1000;
/** 【原作】開始時は 0（妖怪ウォッチ3 の公式ルール） */
export const SG_START = 0;
/** 妖気速度ランク 1〜6 の、1ターン（だれかが1回行動）ごとの SG 増加。= 5 × 1000 ÷ 原作の満タンの量（170・150・125・100・85・60） */
export const SG_PER_TURN_BY_RANK = [29, 33, 40, 50, 59, 83] as const;

// ---- 構え（§6.2〜6.3） ----
export const CHARGE_TIERS: readonly { maxTick: number; mult: number }[] = [
  { maxTick: 9, mult: 1000 },
  { maxTick: 19, mult: 1100 },
  { maxTick: 40, mult: 1200 },
];
/** これを超えたら自動で解放（Miss 扱い） */
export const CHARGE_MAX_TICKS = 40;
export const SKILL_CURSOR_PERIOD = 16;
export const PERFECT_CELLS: readonly number[] = [7, 8];
export const GOOD_CELLS: readonly number[] = [5, 6, 9, 10];
export const QUALITY_PERFECT = 1150;
export const QUALITY_GOOD = 1000;
export const QUALITY_MISS = 800;
/** キャンセル後の再構え制限 */
export const ULT_LOCKOUT_TICKS = 60;

// ---- 奥義（§6.4〜6.5） ----
export const ULT_SINGLE_POWER = 150;
export const ULT_ALL_POWER = 130;
export const ULT_BREAK_POWER = 130;
/** 回復の奥義：floor((SPA + これ) / 2) */
export const ULT_HEAL_POWER = 70;
export const GRAND_MULT = 2000;

// ---- 呪付・加護（§7） ----
/** 呪付の成功率（‰）。5%〜100% に収める */
export const CURSE_SUCCESS_BASE = 750;
export const CURSE_SUCCESS_MIN = 50;
export const CURSE_SUCCESS_MAX = 1000;
export const EFFECT_DURATION = 300;
/** 効果の段階。0 = 大（ふつう）、1 = 超（奥義）、2 = 究極（大奥義） */
export const TIER_STAT_PERMIL = [300, 400, 500] as const;
/** 段階ごとの効果時間の倍率（‰） */
export const TIER_DURATION_PERMIL = [1000, 1500, 2000] as const;
/** 蝕毒：1秒ごとに最大HPの何‰（段階ごと。大の 2% を基準に比例させた仮の値） */
export const POISON_PERMIL = [20, 26, 33] as const;
/** 再生：1秒ごとに最大HPの何‰ */
export const REGEN_PERMIL = [30, 40, 50] as const;
/** 集気：1ターンの SG 増加をこれだけ増やす（‰） */
export const GATHER_BONUS_PERMIL = [500, 667, 833] as const;
/** 蝕毒・再生が効く間隔 */
export const DOT_INTERVAL = 20;
/** 浄化にかかる時間（§7.3） */
export const PURIFY_TICKS = 40;
/** ステの倍率の合計の下限（§12.4） */
export const STAT_MULT_MIN = 100;

// ---- 回転・標的（§8.1〜8.2） ----
export const ROTATE_COOLDOWN = 60;
export const TARGET_COOLDOWN = 20;

// ---- 装備（§8.3） ----
export const EQUIP_STAT_BONUS = 15;
export const EQUIP_HP_BONUS = 60;
/** 妖気の鈴：1ターンの SG 増加をこれだけ増やす（‰） */
export const EQUIP_SG_BONUS_PERMIL = 500;

// ---- 特性（§8.5） ----
export const TRAIT_KEYSTONE_DEF = 300;
/** 〇の心得：その属性のダメージ ×1.25 */
export const TRAIT_ADEPT_MULT = 1250;
export const TRAIT_TAILWIND_SPD = 100;
/** 屍喰い：敵を倒すと最大 HP のこれだけ回復（‰） */
export const TRAIT_DEVOUR_HEAL = 200;
/** 怨念：倒した相手に、その相手の最大 HP のこれだけのダメージ（‰） */
export const TRAIT_GRUDGE_DAMAGE = 250;
/** 毒の肌：受けたダメージの 1/4 を返す */
export const TRAIT_THORNS_DIV = 4;
/** 鏡返し：受けたダメージの 1/2 を返す */
export const TRAIT_MIRROR_DIV = 2;
/** 逆上：HP がこれ以下（‰）の間 ATK + TRAIT_RAGE_ATK */
export const TRAIT_RAGE_HP = 250;
export const TRAIT_RAGE_ATK = 500;
export const TRAIT_IRON_GUARD_MULT = 250;
/** 吸精：与えたダメージのこれだけ回復（‰） */
export const TRAIT_DRAIN = 250;
export const TRAIT_SPIRIT_SMOKE = 500;
/** 祈り：隣の味方が行動するたびに最大 HP のこれだけ回復（‰） */
export const TRAIT_PRAYER_HEAL = 20;
/** 後見：前衛の味方が行動するたびに最大 HP のこれだけ回復（‰） */
export const TRAIT_BENCH_HEAL = 10;
export const TRAIT_CONQUEROR_ATK = 150;
export const TRAIT_CONQUEROR_MAX = 3;
/** 一閃：クリティカルが CRIT_DENOM 回にこれだけ */
export const TRAIT_CRIT_EYE_CHANCE = 22;

// ---- つつき（§8.4） ----
export const POKE_TICKS = 60;
export const POKE_CELLS = 16;
export const POKE_WEAK_MOVE_TICKS = 10;
export const POKE_TAP_INTERVAL = 2;
export const POKE_GAUGE_WEAK = 3;
export const POKE_GAUGE_NORMAL = 1;
export const POKE_GAUGE_GOAL = 30;
/** 弱点のマスをつついたときのダメージ：最大HPの何‰ */
export const POKE_WEAK_DAMAGE_PERMIL = 10;
export const POKE_SG_DRAIN = 400;
export const POKE_SG_GAIN = 150;
export const POKE_CURSE_EXTEND = 100;
export const POKE_COOLDOWN = 160;

// ---- 陣（§9） ----
export const FORMATION_PERMIL_2 = 150;
export const FORMATION_PERMIL_3 = 250;

// ---- 勝敗（§10） ----
/** これ以降、通常攻撃・術・奥義のダメージは 999 */
export const SUDDEN_DEATH_TICKS = 6000;
export const SUDDEN_DEATH_DAMAGE = 999;
export const TIME_LIMIT_TICKS = 7200;

// ---- 努力ポイント（§2.1） ----
export const EFFORT_TOTAL = 40;
export const EFFORT_MAX_PER_STAT = 20;
export const EFFORT_HP_PER_POINT = 4;

// ---- チーム（§2.2） ----
export const TEAM_SIZE = 6;
export const RANK_LIMITS = { S: 2, A: 2, B: 6 } as const;

// ---- 乱数の流れの番号（§4.5） ----
/** 0〜11 はユニット、12・13 は各プレイヤーのつつき */
export const RNG_STREAM_POKE_BASE = 12;
