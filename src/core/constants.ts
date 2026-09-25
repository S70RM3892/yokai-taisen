// 戦闘の数値はすべてここにまとめる（BATTLE_SPEC.md 冒頭：数値は1か所の定数ファイルに）。
// 倍率は ‰（1000 = 1.0倍）。時間は tick（1 tick = 50ms）。

/** 1秒あたりの tick 数（§0） */
export const TICKS_PER_SEC = 20;

// ---- 行動ゲージ（§4.1） ----
export const AG_FULL = 1000;
export const AG_BASE_PER_TICK = 5;
export const AG_SPD_DIVISOR = 10;
/** 開始時の前衛の AG */
export const AG_START_FRONT = 300;

// ---- なまけ・クリティカル（§4.6） ----
export const CRIT_CHANCE_PERMIL = 50;
export const CRIT_MULT = 2000;

// ---- 行動の威力（§4.3） ----
export const ATTACK_POWER = 30;
export const GUARD_MULT = 500;

// ---- ダメージ（§5） ----
export const VARIATION_MIN = 980;
export const VARIATION_MAX = 1020;
export const WEAK_MULT = 1500;
export const RESIST_MULT = 500;

// ---- 妖気ゲージ（§6.1） ----
export const SG_FULL = 1000;
export const SG_START = 500;
/** 妖気速度ランク 1〜6 の SG 増加/tick */
export const SG_RATE_BY_RANK = [2, 3, 4, 5, 6, 7] as const;
/** 被ダメージによる SG 増加：floor(ダメージ × これ / 最大HP) */
export const SG_ON_HIT_FACTOR = 500;

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
export const ULT_ALL_POWER = 70;
export const ULT_BREAK_POWER = 100;
/** 回復の奥義：SPA × これ / 1000 */
export const ULT_HEAL_PERMIL = 600;
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
/** 集気：SG の増加 +/tick */
export const GATHER_BONUS = [3, 4, 5] as const;
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
export const EQUIP_SG_BONUS = 1;

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
