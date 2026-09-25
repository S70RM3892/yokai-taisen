// 1 tick を進める（BATTLE_SPEC §3）。処理順を変えるとリプレイが壊れる。

import * as C from "./constants.js";
import {
  ACTION_ORDER,
  ADEPT_ELEMENT,
  type ActionKind,
  type BlessingKind,
  CURSE_CATEGORY,
  type CurseKind,
  type Element,
  natureById,
  type StatKey,
  UNITS,
} from "./data.js";
import type { BattleEvent, DamageSource, Quality } from "./events.js";
import { type Input, inputCategory, type PlayerInput } from "./input.js";
import { randInt, randRange } from "./rng.js";
import { agNeeded, backHasTrait, effectiveStat, formationPermil, hasTrait, wheelNeighbors } from "./stats.js";
import {
  aliveFront,
  type BattleState,
  hpRatio,
  isAlive,
  isFront,
  type PlayerId,
  type PlayerState,
  positionOf,
  type UnitState,
} from "./state.js";

export interface StepResult {
  state: BattleState;
  events: BattleEvent[];
}

/** 純粋な形：元の状態は変えず、新しい状態を返す */
export function step(state: BattleState, inputs: readonly PlayerInput[] = []): StepResult {
  const next = structuredClone(state);
  const events: BattleEvent[] = [];
  stepInPlace(next, inputs, events);
  return { state: next, events };
}

/** 状態をその場で書き換える形（シミュレーター用に速い） */
export function stepInPlace(s: BattleState, inputs: readonly PlayerInput[], events: BattleEvent[]): void {
  if (s.outcome) return;

  // 1. 入力の処理（P1 → P2、プレイヤーの中では 回転 → 標的 → 浄化 → 奥義 → つつき）
  for (const pid of [0, 1] as const) {
    const mine = inputs
      .map((x, i) => ({ x, i }))
      .filter((o) => o.x.player === pid)
      .sort((a, b) => inputCategory(a.x.input) - inputCategory(b.x.input) || a.i - b.i);
    for (const { x } of mine) {
      if (!handleInput(s, pid, x.input, events)) events.push({ t: "dropped", player: pid, input: x.input });
    }
  }

  // 2. 構えの進行
  for (const pid of [0, 1] as const) progressStance(s, pid, events);

  // 3. AG の加算
  for (const pid of [0, 1] as const) addAg(s, pid);

  // 4. 行動の解決（1体行動するたびに前衛全員の SG が増える）
  resolveActions(s, events);

  // 5. 継続効果
  for (const pid of [0, 1] as const) tickEffects(s, pid, events);

  // 6. 浄化とつつきの進行
  for (const pid of [0, 1] as const) progressPurify(s, pid, events);
  for (const pid of [0, 1] as const) progressPoke(s, pid, events);

  // 7. 前衛が全滅していたら強制回転 → 勝敗の判定（戦闘不能は HP が 0 になった瞬間に処理している。§12.2）
  for (const pid of [0, 1] as const) forcedRotation(s, pid, events);
  s.tick++;
  judge(s, events);
}

// =====================================================================
// ステータス
// =====================================================================

function mul(x: number, permil: number): number {
  return Math.floor((x * permil) / 1000);
}

// =====================================================================
// 狙う相手（§4.4）
// =====================================================================

export function pickEnemyTarget(me: PlayerState, enemy: PlayerState): UnitState | null {
  if (me.target !== null) {
    const t = enemy.units[me.target];
    if (isAlive(t) && isFront(enemy, t.index)) return t;
  }
  // 特性「隠れ身」は、ほかに狙える敵がいれば選ばない（§8.5）
  const alive = [0, 1, 2].map((pos) => enemy.units[enemy.wheel[pos]]).filter(isAlive);
  const visible = alive.filter((u) => !hasTrait(u, "hidden"));
  const pool = visible.length > 0 ? visible : alive;
  let best: UnitState | null = null;
  let bestRatio = 0;
  for (const u of pool) {
    const r = hpRatio(u);
    if (best === null || r < bestRatio) {
      best = u;
      bestRatio = r;
    }
  }
  return best;
}

/** 加護をかける相手（§7.2）。再生のときは caster の乱数を使う */
export function pickBlessTarget(p: PlayerState, kind: BlessingKind, caster?: UnitState): UnitState | null {
  let cands = aliveFront(p);
  if (kind === "gather") cands = cands.filter((u) => u.sg < C.SG_FULL);
  if (cands.length === 0) return null;
  // 【原作】まだ加護がかかっていない味方を優先する
  const fresh = cands.filter((u) => u.blessing === null);
  if (fresh.length > 0) cands = fresh;
  // 【原作】継続回復はランダム
  if (kind === "regen") return caster ? cands[randInt(caster.rng, cands.length)] : cands[0];
  // 小さいほど優先するキー（同じなら位置が小さい方）
  const key = (u: UnitState): number => {
    switch (kind) {
      case "rally":
        return -(effectiveStat(p, u, "atk") + effectiveStat(p, u, "spa"));
      case "fortify":
        return -effectiveStat(p, u, "def");
      case "haste":
        return -effectiveStat(p, u, "spd");
      case "gather":
        return u.sg;
      case "ward":
        return (u.curse ? 0 : 10000) + hpRatio(u);
    }
  };
  const ordered = cands
    .map((u) => ({ u, k: key(u), pos: positionOf(p, u.index) }))
    .sort((a, b) => a.k - b.k || a.pos - b.pos);
  return ordered[0].u;
}

// =====================================================================
// ダメージ・回復・戦闘不能
// =====================================================================

/** 【原作】（攻撃側のステ ＋ 技の威力）÷ 2 − 防御側のまもり ÷ 4（§5） */
export function baseDamage(attackStat: number, power: number, defense: number): number {
  return Math.floor((attackStat + power) / 2) - Math.floor(defense / 4);
}

interface HitOptions {
  power: number;
  stat: StatKey;
  element: Element | null;
  source: DamageSource;
  canCrit: boolean;
  ignoreGuard: boolean;
  chargeMult: number;
  qualityMult: number;
  grandMult: number;
}

/** ダメージを計算して与える（§5・§12.4） */
/** ダメージを与える。なまけている敵か呪付のかかった敵に当てたら true（§6.1 の妖気のボーナス） */
function hit(
  s: BattleState,
  events: BattleEvent[],
  atkP: PlayerState,
  attacker: UnitState,
  defP: PlayerState,
  defender: UnitState,
  o: HitOptions,
): boolean {
  const weakened = defender.loafing || defender.curse !== null;
  const a = effectiveStat(atkP, attacker, o.stat);
  const d = effectiveStat(defP, defender, "def");
  let dmg = baseDamage(a, o.power, d);
  let crit = false;
  let critChance = defender.loafing ? C.CRIT_CHANCE_VS_LOAFING : C.CRIT_CHANCE;
  if (hasTrait(attacker, "critEye")) critChance = Math.max(critChance, C.TRAIT_CRIT_EYE_CHANCE);
  if (o.canCrit && randInt(attacker.rng, C.CRIT_DENOM) < critChance) {
    // 【原作】クリティカルは守りを無視して 1.5 倍（§4.6）
    crit = true;
    dmg = mul(Math.floor((a + o.power) / 2), C.CRIT_MULT);
  }
  const def = UNITS[defender.defIndex];
  if (o.element !== null) {
    if (o.element === def.weak) dmg = mul(dmg, C.WEAK_MULT);
    else if (o.element === def.resist) dmg = mul(dmg, C.RESIST_MULT);
    if (ADEPT_ELEMENT[UNITS[attacker.defIndex].trait] === o.element) dmg = mul(dmg, C.TRAIT_ADEPT_MULT);
  }
  const ignoreGuard = o.ignoreGuard || (o.source === "attack" && hasTrait(attacker, "guardBreak"));
  if (defender.guarding && !ignoreGuard) {
    dmg = mul(dmg, hasTrait(defender, "ironGuard") ? C.TRAIT_IRON_GUARD_MULT : C.GUARD_MULT);
  }
  dmg = mul(dmg, o.chargeMult);
  dmg = mul(dmg, o.qualityMult);
  dmg = mul(dmg, o.grandMult);
  dmg = mul(dmg, randRange(attacker.rng, C.VARIATION_MIN, C.VARIATION_MAX));
  if (dmg < 1) dmg = 1;
  // 【原作】サドンデス：与えるダメージが 999 になる（§10）
  if (s.tick >= C.SUDDEN_DEATH_TICKS) dmg = C.SUDDEN_DEATH_DAMAGE;
  // 特性「水喰い」：水属性のダメージは回復になる
  if (o.element === "water" && hasTrait(defender, "waterEater")) {
    heal(events, defender, dmg, attacker.uid);
    return weakened;
  }
  applyDamage(s, events, defP, defender, dmg, attacker.uid, o.source, crit);
  // 特性：吸精・毒の肌・鏡返し（§8.5）
  if ((o.source === "attack" || o.source === "skill") && hasTrait(attacker, "drain")) {
    heal(events, attacker, Math.floor((dmg * C.TRAIT_DRAIN) / 1000), attacker.uid);
  }
  const inStance = defP.stance?.unit === defender.index;
  if (o.source === "attack" && hasTrait(defender, "thorns") && !inStance) {
    applyDamage(s, events, atkP, attacker, Math.floor(dmg / C.TRAIT_THORNS_DIV), defender.uid, "trait", false);
  }
  if (o.source === "skill" && hasTrait(defender, "mirror")) {
    applyDamage(s, events, atkP, attacker, Math.floor(dmg / C.TRAIT_MIRROR_DIV), defender.uid, "trait", false);
  }
  return weakened;
}

function unitByUid(s: BattleState, uid: number): UnitState {
  return s.players[uid < C.TEAM_SIZE ? 0 : 1].units[uid % C.TEAM_SIZE];
}

/** 1ターン（だれかが1回行動）で増える SG（§6.1） */
export function sgPerTurn(p: PlayerState, u: UnitState): number {
  if (u.curse?.kind === "seal") return 0;
  const base: number = C.SG_PER_TURN_BY_RANK[UNITS[u.defIndex].sgRank - 1];
  let permil = 1000;
  if (wheelNeighbors(p, u).some((v) => hasTrait(v, "spiritSmoke"))) permil += C.TRAIT_SPIRIT_SMOKE;
  if (u.blessing?.kind === "gather") permil += C.GATHER_BONUS_PERMIL[u.blessing.tier];
  if (u.equipment === "spirit_bell") permil += C.EQUIP_SG_BONUS_PERMIL;
  return mul(base, permil);
}

function addSg(u: UnitState, amount: number): void {
  if (!isAlive(u) || amount <= 0) return;
  u.sg = Math.min(C.SG_FULL, u.sg + amount);
}

function applyDamage(
  s: BattleState,
  events: BattleEvent[],
  p: PlayerState,
  u: UnitState,
  amount: number,
  src: number | null,
  source: DamageSource,
  crit: boolean,
): void {
  if (!isAlive(u)) return;
  events.push({ t: "damage", src, dst: u.uid, amount, source, crit });
  const isAttack = source === "attack" || source === "skill" || source === "ult";
  if (u.hp - amount <= 0 && isAttack && u.equipment === "stand_in_doll" && !u.dollUsed) {
    u.dollUsed = true;
    u.hp = 1;
    events.push({ t: "doll", uid: u.uid });
  } else if (u.hp - amount <= 0 && hasTrait(u, "endure") && !u.endureUsed) {
    // 特性「踏ん張り」（§8.5）
    u.endureUsed = true;
    u.hp = 1;
    events.push({ t: "endure", uid: u.uid });
  } else {
    u.hp = Math.max(0, u.hp - amount);
  }
  if (u.hp > 0) return;
  const grudge = UNITS[u.defIndex].trait === "grudge";
  knockOut(s, events, p, u);
  if (src === null || src === u.uid) return;
  const killer = unitByUid(s, src);
  if (!isAlive(killer)) return;
  // 特性：屍喰い・勝ち鬨・怨念（§8.5）
  if (hasTrait(killer, "devour")) heal(events, killer, Math.floor((killer.maxHp * C.TRAIT_DEVOUR_HEAL) / 1000), killer.uid);
  if (hasTrait(killer, "conqueror")) killer.conquests = Math.min(C.TRAIT_CONQUEROR_MAX, killer.conquests + 1);
  if (grudge) {
    const kp = s.players[killer.owner];
    applyDamage(s, events, kp, killer, Math.floor((killer.maxHp * C.TRAIT_GRUDGE_DAMAGE) / 1000), u.uid, "trait", false);
  }
}

function heal(events: BattleEvent[], u: UnitState, amount: number, src: number | null): void {
  if (!isAlive(u)) return;
  const before = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + amount);
  if (u.hp > before) events.push({ t: "heal", src, dst: u.uid, amount: u.hp - before });
}

function knockOut(s: BattleState, events: BattleEvent[], p: PlayerState, u: UnitState): void {
  u.hp = 0;
  u.ag = 0;
  u.sg = 0;
  u.curse = null;
  u.blessing = null;
  u.guarding = false;
  u.loafing = false;
  u.pendingAction = null;
  events.push({ t: "ko", uid: u.uid });
  const st = p.stance;
  if (st && (st.unit === u.index || st.partners.includes(u.index))) cancelStance(s, u.owner, events, "ko");
  if (p.purify && p.purify.unit === u.index) p.purify = null;
}

// =====================================================================
// 呪付・加護（§7）
// =====================================================================

export function curseSuccessPermil(
  srcP: PlayerState,
  src: UnitState,
  dstP: PlayerState,
  dst: UnitState,
  kind: CurseKind,
): number {
  let rate = C.CURSE_SUCCESS_BASE;
  rate += formationPermil(srcP, src, CURSE_CATEGORY[kind] === "stat" ? "miyabi" : "tatari");
  rate -= formationPermil(dstP, dst, "shizume");
  return Math.max(C.CURSE_SUCCESS_MIN, Math.min(C.CURSE_SUCCESS_MAX, rate));
}

function applyCurse(
  events: BattleEvent[],
  srcP: PlayerState,
  src: UnitState,
  dstP: PlayerState,
  dst: UnitState,
  kind: CurseKind,
  tier: number,
  roll: boolean,
): void {
  // 特性「呪詛の才」：味方がかける呪付が1段強くなる（§8.5）
  if (srcP.units.some((v) => hasTrait(v, "curseMaster"))) tier = Math.min(2, tier + 1);
  if (roll && randInt(src.rng, 1000) >= curseSuccessPermil(srcP, src, dstP, dst, kind)) {
    events.push({ t: "curse", src: src.uid, dst: dst.uid, kind, tier, result: "miss" });
    return;
  }
  if (hasTrait(dst, "unbreakable")) {
    events.push({ t: "curse", src: src.uid, dst: dst.uid, kind, tier, result: "immune" });
    return;
  }
  const b = dst.blessing;
  if (b && b.kind === "ward" && b.wardCharges > 0) {
    b.wardCharges--;
    events.push({ t: "curse", src: src.uid, dst: dst.uid, kind, tier, result: "warded" });
    return;
  }
  let duration = Math.floor((C.EFFECT_DURATION * C.TIER_DURATION_PERMIL[tier]) / 1000);
  if (dst.equipment === "ward_charm") duration = Math.floor(duration / 2);
  dst.curse = { kind, tier, remaining: duration, elapsed: 0 };
  events.push({ t: "curse", src: src.uid, dst: dst.uid, kind, tier, result: "hit" });
}

function applyBlessing(events: BattleEvent[], src: UnitState, dst: UnitState, kind: BlessingKind, tier: number): void {
  const duration = Math.floor((C.EFFECT_DURATION * C.TIER_DURATION_PERMIL[tier]) / 1000);
  dst.blessing = { kind, tier, remaining: duration, elapsed: 0, wardCharges: kind === "ward" ? 1 : 0 };
  events.push({ t: "bless", src: src.uid, dst: dst.uid, kind, tier });
  if (kind === "ward" && dst.curse) {
    dst.curse = null;
    events.push({ t: "curseCleared", uid: dst.uid, by: "ward" });
  }
}

// =====================================================================
// 1. 入力
// =====================================================================

function isInt(x: unknown, min: number, max: number): x is number {
  return typeof x === "number" && Number.isInteger(x) && x >= min && x <= max;
}

/** 実行できたら true。できない入力は捨てる（§11） */
function handleInput(s: BattleState, pid: PlayerId, input: Input, events: BattleEvent[]): boolean {
  const p = s.players[pid];
  const e = s.players[1 - pid];
  const poking = p.poke !== null;
  switch (input?.t) {
    case "rotate": {
      if (poking || p.rotateCooldown > 0) return false;
      if (input.dir !== "cw" && input.dir !== "ccw") return false;
      const steps = input.steps ?? 1;
      if (!isInt(steps, 1, 5)) return false;
      rotate(s, pid, input.dir, steps, events);
      return true;
    }
    case "target": {
      if (!isInt(input.enemyUnit, 0, 5) || p.targetCooldown > 0) return false;
      if (!isAlive(e.units[input.enemyUnit]) || p.target === input.enemyUnit) return false;
      p.target = input.enemyUnit;
      p.targetCooldown = C.TARGET_COOLDOWN;
      events.push({ t: "target", player: pid, enemyUnit: input.enemyUnit });
      return true;
    }
    case "purify": {
      if (poking || p.purify || !isInt(input.allySlot, 3, 5)) return false;
      const u = p.units[p.wheel[input.allySlot]];
      if (!isAlive(u) || !u.curse) return false;
      p.purify = { unit: u.index, progress: 0 };
      events.push({ t: "purifyStart", player: pid, uid: u.uid });
      return true;
    }
    case "ultStart": {
      if (poking || p.stance || !isInt(input.allySlot, 0, 2)) return false;
      const u = p.units[p.wheel[input.allySlot]];
      if (!isAlive(u) || u.sg < C.SG_FULL || u.ultLockout > 0) return false;
      const partners: number[] = [];
      if (input.grand === true) {
        for (const pos of [(input.allySlot + 5) % 6, (input.allySlot + 1) % 6]) {
          const v = p.units[p.wheel[pos]];
          if (!isAlive(v) || v.sg < C.SG_FULL) return false;
          partners.push(v.index);
        }
      }
      p.stance = { unit: u.index, startTick: s.tick, grand: input.grand === true, partners, releaseRequested: false };
      events.push({ t: "stance", player: pid, uid: u.uid, grand: input.grand === true });
      return true;
    }
    case "ultRelease": {
      if (poking || !p.stance || p.stance.releaseRequested) return false;
      p.stance.releaseRequested = true;
      return true;
    }
    case "ultCancel": {
      if (poking || !p.stance) return false;
      cancelStance(s, pid, events, "input");
      return true;
    }
    case "pokeStart": {
      if (poking || p.pokeCooldown > 0 || !isInt(input.enemyUnit, 0, 5)) return false;
      const t = e.units[input.enemyUnit];
      if (!pokeable(e, t)) return false;
      p.poke = { target: t.index, elapsed: 0, gauge: 0, weakCell: randInt(p.pokeRng, C.POKE_CELLS), lastTapTick: -1000 };
      events.push({ t: "pokeStart", player: pid, target: t.uid });
      return true;
    }
    case "pokeTap": {
      const k = p.poke;
      if (!k || !isInt(input.cell, 0, C.POKE_CELLS - 1)) return false;
      if (s.tick - k.lastTapTick < C.POKE_TAP_INTERVAL) return false;
      const t = e.units[k.target];
      if (!pokeable(e, t)) return false;
      k.lastTapTick = s.tick;
      if (input.cell === k.weakCell) {
        k.gauge += C.POKE_GAUGE_WEAK;
        const dmg = Math.max(1, Math.floor((t.maxHp * C.POKE_WEAK_DAMAGE_PERMIL) / 1000));
        applyDamage(s, events, e, t, dmg, null, "poke", false);
      } else {
        k.gauge += C.POKE_GAUGE_NORMAL;
      }
      if (k.gauge >= C.POKE_GAUGE_GOAL && isAlive(t)) pokeSuccess(p, e, t, pid, events);
      return true;
    }
    case "pokeStop": {
      if (!p.poke) return false;
      endPoke(p, pid, e, "stopped", events);
      return true;
    }
    default:
      return false;
  }
}

function rotate(s: BattleState, pid: PlayerId, dir: "cw" | "ccw", steps: number, events: BattleEvent[]): void {
  const p = s.players[pid];
  const old = p.wheel;
  const shift = dir === "cw" ? steps : 6 - steps;
  const next = new Array<number>(6);
  for (let pos = 0; pos < 6; pos++) next[(pos + shift) % 6] = old[pos];
  p.wheel = next;
  p.rotateCooldown = C.ROTATE_COOLDOWN;
  events.push({ t: "rotate", player: pid, dir, steps });
  triggerFirstStrike(p, events);
  const st = p.stance;
  // 大奥義は回すとキャンセル。普通の構えは構えたユニットが後衛に行ったらキャンセル（§6.5・§8.1）
  if (st && (st.grand || !isFront(p, st.unit))) cancelStance(s, pid, events, "rotate");
  if (p.purify && isFront(p, p.purify.unit)) p.purify = null;
}

/** 特性「先駆け」：初めて前衛に出たら、すぐに行動できる（§8.5） */
function triggerFirstStrike(p: PlayerState, events: BattleEvent[]): void {
  for (let pos = 0; pos < 3; pos++) {
    const u = p.units[p.wheel[pos]];
    if (hasTrait(u, "firstStrike") && !u.firstStrikeUsed) {
      u.firstStrikeUsed = true;
      u.ag = Math.max(u.ag, agNeeded(p, u));
      events.push({ t: "firstStrike", uid: u.uid });
    }
  }
}

function cancelStance(s: BattleState, pid: PlayerId, events: BattleEvent[], reason: "input" | "rotate" | "ko"): void {
  const p = s.players[pid];
  const st = p.stance;
  if (!st) return;
  const u = p.units[st.unit];
  if (isAlive(u)) u.ultLockout = C.ULT_LOCKOUT_TICKS;
  p.stance = null;
  events.push({ t: "stanceCancel", player: pid, uid: u.uid, grand: st.grand, reason });
}

// =====================================================================
// 2. 構えの進行・奥義の発動（§6）
// =====================================================================

function progressStance(s: BattleState, pid: PlayerId, events: BattleEvent[]): void {
  const p = s.players[pid];
  const st = p.stance;
  if (!st) return;
  const charge = s.tick - st.startTick;
  const auto = !st.releaseRequested && charge > C.CHARGE_MAX_TICKS;
  if (!st.releaseRequested && !auto) return;

  let chargeMult = C.CHARGE_TIERS[C.CHARGE_TIERS.length - 1].mult;
  for (const tier of C.CHARGE_TIERS) {
    if (charge <= tier.maxTick) {
      chargeMult = tier.mult;
      break;
    }
  }
  let quality: Quality = "miss";
  if (!auto) {
    const cursor = charge % C.SKILL_CURSOR_PERIOD;
    if (C.PERFECT_CELLS.includes(cursor)) quality = "perfect";
    else if (C.GOOD_CELLS.includes(cursor)) quality = "good";
  }
  const qualityMult =
    quality === "perfect" ? C.QUALITY_PERFECT : quality === "good" ? C.QUALITY_GOOD : C.QUALITY_MISS;

  const u = p.units[st.unit];
  u.sg = 0;
  for (const i of st.partners) p.units[i].sg = 0;
  p.stance = null;
  events.push({ t: "ult", player: pid, uid: u.uid, grand: st.grand, quality, charge, auto });
  fireUlt(s, pid, u, st.grand, chargeMult, qualityMult, events);
}

function fireUlt(
  s: BattleState,
  pid: PlayerId,
  u: UnitState,
  grand: boolean,
  chargeMult: number,
  qualityMult: number,
  events: BattleEvent[],
): void {
  const p = s.players[pid];
  const e = s.players[1 - pid];
  const ult = UNITS[u.defIndex].ult;
  const grandMult = grand ? C.GRAND_MULT : 1000;
  const tier = grand ? 2 : 1;
  switch (ult.kind) {
    case "single":
    case "break": {
      const t = pickEnemyTarget(p, e);
      if (!t) return;
      const bonus = hit(s, events, p, u, e, t, {
        power: ult.power ?? (ult.kind === "single" ? C.ULT_SINGLE_POWER : C.ULT_BREAK_POWER),
        stat: ult.stat,
        element: ult.element,
        source: "ult",
        canCrit: false,
        ignoreGuard: grand || ult.kind === "break",
        chargeMult,
        qualityMult,
        grandMult,
      });
      if (bonus) addSg(u, sgPerTurn(p, u));
      return;
    }
    case "all": {
      let bonus = false;
      for (const t of aliveFront(e)) {
        if (!isAlive(t)) continue;
        const b = hit(s, events, p, u, e, t, {
          power: ult.power ?? C.ULT_ALL_POWER,
          stat: ult.stat,
          element: ult.element,
          source: "ult",
          canCrit: false,
          ignoreGuard: grand,
          chargeMult,
          qualityMult,
          grandMult,
        });
        bonus = bonus || b;
      }
      if (bonus) addSg(u, sgPerTurn(p, u));
      return;
    }
    case "heal": {
      const spa = effectiveStat(p, u, "spa");
      for (const t of aliveFront(p)) {
        let amount = Math.floor((spa + C.ULT_HEAL_POWER) / 2);
        amount = mul(amount, 1000 + formationPermil(p, u, "nagomi"));
        amount = mul(amount, qualityMult);
        amount = mul(amount, grandMult);
        amount = mul(amount, randRange(u.rng, C.VARIATION_MIN, C.VARIATION_MAX));
        heal(events, t, amount, u.uid);
      }
      return;
    }
    case "curseAll": {
      for (const t of aliveFront(e)) applyCurse(events, p, u, e, t, ult.curse, tier, false);
      return;
    }
    case "blessAll": {
      for (const t of aliveFront(p)) applyBlessing(events, u, t, ult.blessing, tier);
      return;
    }
  }
}

// =====================================================================
// 3. ゲージ
// =====================================================================

function frozenUnits(p: PlayerState): number[] {
  const st = p.stance;
  if (!st) return [];
  return [st.unit, ...st.partners];
}

function addAg(s: BattleState, pid: PlayerId): void {
  const p = s.players[pid];
  const frozen = frozenUnits(p);
  for (let pos = 0; pos < 3; pos++) {
    const u = p.units[p.wheel[pos]];
    if (!isAlive(u) || frozen.includes(u.index)) continue;
    u.ag += C.AG_PER_TICK;
    if (u.pendingAction !== null) u.ag = Math.min(u.ag, agNeeded(p, u));
  }
}

/** 特性「祈り」「後見」：行動した味方の HP を回復する（§8.5） */
function afterOwnAction(p: PlayerState, u: UnitState, events: BattleEvent[]): void {
  if (!isAlive(u) || !isFront(p, u.index)) return;
  for (const v of wheelNeighbors(p, u)) {
    if (hasTrait(v, "prayer")) heal(events, u, Math.floor((u.maxHp * C.TRAIT_PRAYER_HEAL) / 1000), v.uid);
  }
  for (const pos of [3, 4, 5]) {
    const v = p.units[p.wheel[pos]];
    if (hasTrait(v, "benchHeal")) heal(events, u, Math.floor((u.maxHp * C.TRAIT_BENCH_HEAL) / 1000), v.uid);
  }
}

/** だれかが1回行動した：両チームの前衛で生きているユニット全員の SG が増える（§6.1） */
function passTurn(s: BattleState): void {
  for (const p of s.players) {
    for (let pos = 0; pos < 3; pos++) {
      const u = p.units[p.wheel[pos]];
      addSg(u, sgPerTurn(p, u));
    }
  }
}

// =====================================================================
// 4. 行動（§4）
// =====================================================================

function resolveActions(s: BattleState, events: BattleEvent[]): void {
  const ready: { u: UnitState; pid: PlayerId; over: number; spd: number; pos: number }[] = [];
  for (const pid of [0, 1] as const) {
    const p = s.players[pid];
    const frozen = frozenUnits(p);
    for (let pos = 0; pos < 3; pos++) {
      const u = p.units[p.wheel[pos]];
      if (!isAlive(u) || frozen.includes(u.index)) continue;
      const need = agNeeded(p, u);
      if (u.ag >= need) ready.push({ u, pid, over: u.ag - need, spd: effectiveStat(p, u, "spd"), pos });
    }
  }
  // 超えた分が大きい順 → SPD が高い順 → P1 が先 → 位置が小さい順
  ready.sort((a, b) => b.over - a.over || b.spd - a.spd || a.pid - b.pid || a.pos - b.pos);
  for (const r of ready) {
    if (s.players[0].units.every((u) => !isAlive(u)) || s.players[1].units.every((u) => !isAlive(u))) return;
    const p = s.players[r.pid];
    if (!isAlive(r.u) || !isFront(p, r.u.index) || r.u.ag < agNeeded(p, r.u)) continue;
    if (frozenUnits(p).includes(r.u.index)) continue;
    if (act(s, r.pid, r.u, events)) {
      afterOwnAction(p, r.u, events);
      passTurn(s);
    }
  }
}

/** 性格の確率で行動を1つ引く（§4.2） */
export function rollAction(u: Pick<UnitState, "nature" | "rng">): ActionKind {
  const w = natureById(u.nature).weights;
  const x = randInt(u.rng, 100);
  let acc = 0;
  for (let i = 0; i < ACTION_ORDER.length; i++) {
    acc += w[i];
    if (x < acc) return ACTION_ORDER[i];
  }
  return "attack";
}

/** 行動したら true（敵がいなくて待つときは false） */
function act(s: BattleState, pid: PlayerId, u: UnitState, events: BattleEvent[]): boolean {
  const p = s.players[pid];
  const e = s.players[1 - pid];
  const def = UNITS[u.defIndex];
  const need = agNeeded(p, u);

  let action = u.pendingAction;
  if (action === null) {
    u.guarding = false;
    u.loafing = false;
    // なまけの判定は行動を選ぶ前（§4.6）
    if (u.equipment !== "diligence_band" && randInt(u.rng, 1000) < def.loafPermil) {
      u.loafing = true;
      u.ag -= need;
      events.push({ t: "action", uid: u.uid, action: "loaf" });
      return true;
    }
    action = rollAction(u);
  }

  const enemyTarget = pickEnemyTarget(p, e);
  let blessTarget: UnitState | null = null;
  if (action === "curse" && !enemyTarget) action = "attack";
  if (action === "bless") {
    blessTarget = pickBlessTarget(p, def.blessing, u);
    if (!blessTarget) action = "attack";
  }
  // 敵の前衛に生きているユニットがいなければ、AG を 1000 で止めて待つ（§12.2）
  if ((action === "attack" || action === "skill" || action === "curse") && !enemyTarget) {
    u.pendingAction = action;
    u.ag = need;
    return false;
  }
  u.pendingAction = null;
  u.ag -= need;
  events.push({ t: "action", uid: u.uid, action });

  switch (action) {
    case "attack":
      if (
        hit(s, events, p, u, e, enemyTarget!, {
        power: def.attackPower,
        stat: "atk",
        element: null,
        source: "attack",
        canCrit: true,
        ignoreGuard: false,
        chargeMult: 1000,
        qualityMult: 1000,
        grandMult: 1000,
      })
      )
        addSg(u, sgPerTurn(p, u));
      return true;
    case "skill":
      if (
        hit(s, events, p, u, e, enemyTarget!, {
        power: def.skillPower,
        stat: "spa",
        element: def.skillElement,
        source: "skill",
        canCrit: false,
        ignoreGuard: false,
        chargeMult: 1000,
        qualityMult: 1000,
        grandMult: 1000,
      })
      )
        addSg(u, sgPerTurn(p, u));
      return true;
    case "guard":
      u.guarding = true;
      return true;
    case "curse":
      applyCurse(events, p, u, e, enemyTarget!, def.curse, 0, true);
      return true;
    case "bless":
      applyBlessing(events, u, blessTarget!, def.blessing, 0);
      return true;
  }
}

// =====================================================================
// 5. 継続効果（§12.5）
// =====================================================================

function tickEffects(s: BattleState, pid: PlayerId, events: BattleEvent[]): void {
  const p = s.players[pid];
  if (p.rotateCooldown > 0) p.rotateCooldown--;
  if (p.targetCooldown > 0) p.targetCooldown--;
  if (p.pokeCooldown > 0) p.pokeCooldown--;
  for (const u of p.units) {
    if (!isAlive(u)) continue;
    if (u.ultLockout > 0) u.ultLockout--;
    // 呪付・加護の時間は後衛では凍結（§7.1）
    if (!isFront(p, u.index)) continue;
    const c = u.curse;
    if (c) {
      c.elapsed++;
      if (c.kind === "poison" && c.elapsed % C.DOT_INTERVAL === 0) {
        const dmg = Math.max(1, Math.floor((u.maxHp * C.POISON_PERMIL[c.tier]) / 1000));
        applyDamage(s, events, p, u, dmg, null, "poison", false);
        if (!isAlive(u)) continue;
      }
      c.remaining--;
      if (c.remaining <= 0) {
        u.curse = null;
        events.push({ t: "curseCleared", uid: u.uid, by: "expire" });
      }
    }
    const b = u.blessing;
    if (b) {
      b.elapsed++;
      if (b.kind === "regen" && b.elapsed % C.DOT_INTERVAL === 0) {
        heal(events, u, Math.max(1, Math.floor((u.maxHp * C.REGEN_PERMIL[b.tier]) / 1000)), null);
      }
      b.remaining--;
      if (b.remaining <= 0) u.blessing = null;
    }
  }
}

// =====================================================================
// 6. 浄化・つつき（§7.3・§8.4）
// =====================================================================

function progressPurify(s: BattleState, pid: PlayerId, events: BattleEvent[]): void {
  const p = s.players[pid];
  const pu = p.purify;
  if (!pu) return;
  const u = p.units[pu.unit];
  if (!isAlive(u) || isFront(p, u.index) || !u.curse) {
    p.purify = null;
    return;
  }
  pu.progress++;
  if (pu.progress >= C.PURIFY_TICKS) {
    u.curse = null;
    p.purify = null;
    events.push({ t: "curseCleared", uid: u.uid, by: "purify" });
  }
}

function pokeable(owner: PlayerState, t: UnitState): boolean {
  return isAlive(t) && isFront(owner, t.index) && (t.curse !== null || t.loafing);
}

function pokeSuccess(p: PlayerState, e: PlayerState, t: UnitState, pid: PlayerId, events: BattleEvent[]): void {
  t.sg = Math.max(0, t.sg - C.POKE_SG_DRAIN);
  for (const u of aliveFront(p)) {
    if (u.curse?.kind !== "seal") u.sg = Math.min(C.SG_FULL, u.sg + C.POKE_SG_GAIN);
  }
  if (t.curse) t.curse.remaining += C.POKE_CURSE_EXTEND;
  endPoke(p, pid, e, "success", events);
}

function endPoke(
  p: PlayerState,
  pid: PlayerId,
  e: PlayerState,
  result: "success" | "fail" | "stopped",
  events: BattleEvent[],
): void {
  if (!p.poke) return;
  events.push({ t: "pokeEnd", player: pid, target: e.units[p.poke.target].uid, result });
  p.poke = null;
  p.pokeCooldown = C.POKE_COOLDOWN;
}

function progressPoke(s: BattleState, pid: PlayerId, events: BattleEvent[]): void {
  const p = s.players[pid];
  const e = s.players[1 - pid];
  const k = p.poke;
  if (!k) return;
  if (!pokeable(e, e.units[k.target])) {
    endPoke(p, pid, e, "stopped", events);
    return;
  }
  k.elapsed++;
  if (k.elapsed >= C.POKE_TICKS) {
    endPoke(p, pid, e, "fail", events);
    return;
  }
  if (k.elapsed % C.POKE_WEAK_MOVE_TICKS === 0) {
    // 今のマス以外の 15 マスから選ぶ
    const r = randInt(p.pokeRng, C.POKE_CELLS - 1);
    k.weakCell = r >= k.weakCell ? r + 1 : r;
  }
}

// =====================================================================
// 7. 勝敗（§10）
// =====================================================================

/** 【原作】前衛が全滅したら、ホイールを半周回して前衛と後衛を入れ替える（§12.2） */
function forcedRotation(s: BattleState, pid: PlayerId, events: BattleEvent[]): void {
  const p = s.players[pid];
  if (aliveFront(p).length > 0) return;
  if (![3, 4, 5].some((pos) => isAlive(p.units[p.wheel[pos]]))) return;
  const old = p.wheel;
  p.wheel = [old[3], old[4], old[5], old[0], old[1], old[2]];
  events.push({ t: "forcedRotate", player: pid });
  triggerFirstStrike(p, events);
  const st = p.stance;
  if (st) cancelStance(s, pid, events, "rotate");
  if (p.purify && isFront(p, p.purify.unit)) p.purify = null;
}

function judge(s: BattleState, events: BattleEvent[]): void {
  if (s.tick === C.SUDDEN_DEATH_TICKS) events.push({ t: "suddenDeath" });
  const dead = s.players.map((p) => p.units.every((u) => !isAlive(u)));
  if (dead[0] || dead[1]) {
    s.outcome = { winner: dead[0] && dead[1] ? null : dead[0] ? 1 : 0, reason: "ko" };
  } else if (s.tick >= C.TIME_LIMIT_TICKS) {
    const score = s.players.map((p) => p.units.reduce((acc, u) => acc + (isAlive(u) ? hpRatio(u) : 0), 0));
    s.outcome = { winner: score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1, reason: "time" };
  }
  if (s.outcome) events.push({ t: "end", outcome: s.outcome });
}
