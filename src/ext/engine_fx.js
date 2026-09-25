// ============================================================================
// 特性・装備・アイテムの効果を対戦ロジックに差し込む部品。
// e: プレイヤー（wheel / units を持つ）、u: 対戦中の妖怪（fx / eq を持つ）
// ============================================================================

// 能力値の上がり下がり（‰）。Jt から呼ばれる。
function fxStatBonus(e, u, stat) {
  const fx = u.fx;
  let r = 0;
  if (fx["up_" + stat]) r += fx["up_" + stat];
  if (stat === "def" && fx.keystone && si(e, u.index) === 1) r += fx.keystone;
  if (stat === "atk" && fx.rage && u.hp * 1e3 <= u.maxHp * (fx.rageAt ?? Jc)) r += fx.rage;
  if (stat === "atk" && fx.conqueror) r += fx.conqueror * u.conquests;
  if (stat === "def" && fx.lowDef && u.hp * 2 <= u.maxHp) r += fx.lowDef;
  if (stat === "spd" && fx.spdLow && u.hp * 2 <= u.maxHp) r += fx.spdLow;
  if (stat === "spd" && Vt(e, u.index)) {
    let tw = 0;
    for (const p of [3, 4, 5]) {
      const b = e.units[e.wheel[p]];
      if (tt(b, "tailwind")) tw = Math.max(tw, b.fx.tailwind);
    }
    r += tw;
  }
  if (u.talisman && u.talisman.stat === stat) r += u.talisman.amount;
  if (u.eq.cursedAllDown && u.curse && stat !== "hp") r -= u.eq.cursedAllDown;
  return r;
}

// 属性の技：得意（adept）・装備（ムゲンすいとう）・受ける側の耐性
function elemMult(att, def, el) {
  let m = 1e3;
  const ad = att.fx["adept_" + el];
  if (ad) m = Bt(m, ad);
  const rs = def.fx["resist_" + el];
  if (rs) m = Bt(m, Math.max(100, 1e3 - rs));
  if (el === "water" && att.eq.waterUp) m = Bt(m, att.eq.waterUp);
  if (el === "water" && def.eq.waterGuard) m = Bt(m, def.eq.waterGuard);
  return m;
}

// 相手しだいで変わるダメージ（とりつかれ中・族・元祖/本家・破邪のお札）
function dmgVsTarget(att, def) {
  let m = 1e3;
  if (att.fx.vsCursed && (def.curse || def.loafing)) m += att.fx.vsCursed;
  const tribe = ct[def.defIndex].tribe;
  if (att.fx["vsTribe_" + tribe]) m += att.fx["vsTribe_" + tribe];
  if (att.eq.vsCamp && def.camp === att.eq.vsCamp) m = Bt(m, att.eq.mult);
  if (att.eq.vsMaga) m = Bt(m, tribe === "maga" ? att.eq.vsMaga : att.eq.vsOther);
  return m;
}

function gainSg(u, v) {
  if (!Se(u) || u.curse?.kind === "seal" || v <= 0) return;
  di(u, v);
}

function healAmt(healer, maxHp, permil) {
  return Math.max(1, Math.floor(Math.floor(maxHp * permil / 1e3) * (1e3 + (healer.fx.healUp ?? 0)) / 1e3));
}

function loafChance(u, def) {
  let p = def.loafPermil * (u.eq.loafMult ?? 1);
  if (u.fx.noLoaf) p = Math.floor(p * Math.max(0, 1e3 - u.fx.noLoaf) / 1e3);
  return p;
}

// ダメージを与えた／受けたあと（Ui から）
function afterHit(state, ev, ap, att, dp, def, source) {
  if (!Se(att)) return;
  if (Se(def) && (source === "attack" || source === "skill" || source === "ult") && def.fx.hitSg) gainSg(def, def.fx.hitSg);
  if (source !== "attack") return;
  if (att.fx.sgSteal && Se(def)) {
    const take = Math.min(def.sg, att.fx.sgSteal);
    if (take > 0) {
      def.sg -= take;
      gainSg(att, take);
      ev.push({ t: "sgSteal", src: att.uid, dst: def.uid, amount: take });
    }
  }
  for (const [k, v] of Object.entries(att.fx)) {
    if (!k.startsWith("inflict_") || !Se(def) || def.curse) continue;
    if (gt(att.rng, 1e3) < v) { Su(ev, ap, att, dp, def, k.slice(8), 0, !1); break; }
  }
  for (const [k, v] of Object.entries(def.fx)) {
    if (!k.startsWith("counter_") || !Se(def) || att.curse) continue;
    if (gt(def.rng, 1e3) < v) { Su(ev, dp, def, ap, att, k.slice(8), 0, !1); break; }
  }
}

// たおれたとき（Xa から）：前衛の味方へ
function onDeathFx(state, ev, p, dead) {
  const fx = dead.fx;
  if (!fx.deathSg && !fx.deathHeal) return;
  for (const u of Ht(p)) {
    if (u === dead) continue;
    if (fx.deathSg) gainSg(u, fx.deathSg);
    if (fx.deathHeal) $a(ev, u, healAmt(dead, u.maxHp, fx.deathHeal), dead.uid);
  }
}

// ---- アイテム（本家の下画面右下「アイテム」） ----
// input: { t: "item", slot: 持ち物の番号, allySlot: ホイールの位置 0〜5 }
function canUseItem(p, slot, allySlot) {
  if (p.itemCooldown > 0 || p.poke || p.stance) return false;
  if (!gr(slot, 0, p.bag.length - 1) || !gr(allySlot, 0, 5)) return false;
  const it = battleItem(p.bag[slot]);
  if (!it) return false;
  const u = p.units[p.wheel[allySlot]];
  switch (it.kind) {
    case "revive": return !Se(u);
    case "flee": return true;
    case "heal": return Se(u) && u.hp < u.maxHp;
    case "soul": return Se(u) && u.sg < Nt && u.curse?.kind !== "seal";
    default: return Se(u);
  }
}

function useItem(state, pid, input, ev) {
  const p = state.players[pid];
  if (!canUseItem(p, input.slot, input.allySlot)) return false;
  const it = battleItem(p.bag[input.slot]);
  const u = p.units[p.wheel[input.allySlot]];
  p.bag.splice(input.slot, 1);
  p.itemCooldown = ITEM_COOLDOWN;
  const fav = u.favorite === it.cat;
  ev.push({ t: "item", player: pid, uid: u.uid, item: it.id, fav });
  switch (it.kind) {
    case "heal": {
      let amt = it.amount;
      if (fav) amt = Bt(amt, FAVORITE_MULT);
      if (u.fx.foodUp) amt = Bt(amt, 1e3 + u.fx.foodUp);
      $a(ev, u, amt, null);
      break;
    }
    case "soul": {
      let amt = it.amount;
      if (fav) amt = Bt(amt, FAVORITE_MULT);
      gainSg(u, amt);
      break;
    }
    case "talisman":
      u.talisman = { stat: it.stat, amount: it.amount, remaining: it.ticks };
      break;
    case "revive": {
      u.hp = Math.max(1, Math.floor(u.maxHp * it.amount / 1e3));
      u.sg = 0, u.curse = null, u.blessing = null, u.loafing = !1, u.guarding = !1, u.pendingAction = null;
      u.ap = bu(p, u);
      ev.push({ t: "revive", uid: u.uid, amount: u.hp });
      break;
    }
    case "flee":
      state.outcome = { winner: null, reason: "flee", by: pid };
      ev.push({ t: "end", outcome: state.outcome });
      break;
  }
  return true;
}

// CPU のアイテムの使い方（回復 → 復活 → 妖気 → おふだ の順に考える）
function cpuItemInput(cpu, state) {
  const p = state.players[cpu.player];
  if (p.itemCooldown > 0 || p.poke || p.stance || p.bag.length === 0) return null;
  if (gt(cpu.rng, 1e3) >= (cpu.params.itemPermil ?? 300)) return null;
  const find = (kind, pred) => p.bag.findIndex(id => { const it = battleItem(id); return it.kind === kind && (!pred || pred(it)); });
  // 前衛で HP が 40% 以下の妖怪を回復
  for (let s = 0; s < 3; s++) {
    const u = p.units[p.wheel[s]];
    if (!Se(u) || u.hp * 10 > u.maxHp * 4) continue;
    const need = u.maxHp - u.hp;
    let best = -1, bestScore = -1e9;
    p.bag.forEach((id, i) => {
      const it = battleItem(id);
      if (it.kind !== "heal") return;
      const amt = it.amount * (u.favorite === it.cat ? 1.25 : 1);
      const score = -Math.abs(need - amt);
      if (score > bestScore) bestScore = score, best = i;
    });
    if (best >= 0) return { t: "item", slot: best, allySlot: s };
  }
  // 気絶した妖怪を漢方で起こす（前衛を優先）
  const rv = find("revive");
  if (rv >= 0) for (const s of [0, 1, 2, 3, 4, 5]) if (!Se(p.units[p.wheel[s]])) return { t: "item", slot: rv, allySlot: s };
  // ひっさつわざが近い前衛に妖気
  const sl = find("soul");
  if (sl >= 0) for (let s = 0; s < 3; s++) {
    const u = p.units[p.wheel[s]];
    if (Se(u) && u.sg >= 500 && u.sg < Nt && u.curse?.kind !== "seal") return { t: "item", slot: sl, allySlot: s };
  }
  // おふだ：その能力がいちばん高い前衛に
  const tl = find("talisman");
  if (tl >= 0) {
    const it = battleItem(p.bag[tl]);
    let best = -1, bv = -1;
    for (let s = 0; s < 3; s++) {
      const u = p.units[p.wheel[s]];
      if (Se(u) && !u.talisman && u[it.stat] > bv) bv = u[it.stat], best = s;
    }
    if (best >= 0) return { t: "item", slot: tl, allySlot: best };
  }
  return null;
}
