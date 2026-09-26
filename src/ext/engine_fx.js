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
  r += honkeStatBonus(e, u, stat);
  return r;
}

// ---- 本家のスキル・魂・とりつきの能力値への効果 ----
function honkeStatBonus(e, u, stat) {
  const fx = u.fx, F = FIELD ?? EMPTY_FIELD;
  let r = 0;
  const pos = si(e, u.index);
  if (pos === 1) r += (fx["center_" + stat] ?? 0) + (fx.center_all ?? 0);
  if (u.curse) {
    if (u.curse.kind === "allDown") r -= lu[u.curse.tier];
    if (fx.cursedAllDown) r -= fx.cursedAllDown;
    if (fx.cursedAllUp) r += fx.cursedAllUp;
  }
  if (u.blessing?.kind === "taunt" && stat === "def" && u.blessing.defUp !== void 0) r += lu[u.blessing.defUp];
  if (stat === "spa" && fx.conqSpa && fx.conqueror) r += fx.conqueror * u.conquests;
  if ((stat === "atk" || stat === "spa") && fx.sgPower) r += Math.floor(fx.sgPower * u.sg / 1e3);
  if (u.dyn?.[stat]) r += u.dyn[stat];
  if (fx.night && F.tick >= mu / 2) r += fx.night;
  r += F.allUpAll + (F.camp[u.camp + "_" + stat] ?? 0);
  // となり（ホイールで両どなり）の妖怪から
  const nbs = jn(e, u);
  for (const nb of nbs) {
    if (!Se(nb)) continue;
    r += (nb.fx["aura_" + stat] ?? 0) + (nb.fx.aura_all ?? 0);
    const hs = ct[nb.defIndex].hskill;
    if (fx.sameSkillUp && hs && hs === ct[u.defIndex].hskill) r += fx.sameSkillUp;
    if (stat === "spa" && fx.pairA && hs === "「うん」") r += fx.pairA;
  }
  if (stat === "atk" && fx.lone && nbs.every(nb => !Se(nb) || !Vt(e, nb.index))) r += fx.lone;
  return r;
}

// ---- 場の効果（前衛にいる妖怪のスキルが、敵味方の全員に効くもの）。tick ごとに作り直す ----
var EMPTY_FIELD = { tick: 0, noLoafAll: 0, noGuardAll: 0, noEvade: 0, allUpAll: 0, loafDmg: 0, healDown: 0, poisonUp: 0, noElemSkill: 0,
  weather: {}, camp: {}, purifyHard: [0, 0], teamNoLoaf: [0, 0], foeLoaf: [1, 1], wheelLock: [0, 0], blessMagnet: null, atkBias: 0 };
var FIELD = null;
function fieldOf(state) {
  const f = { ...EMPTY_FIELD, tick: state.tick, weather: {}, camp: {}, purifyHard: [0, 0], teamNoLoaf: [0, 0], foeLoaf: [1, 1], wheelLock: [0, 0] };
  state.players.forEach((p, pid) => {
    for (let pos = 0; pos < 3; pos++) {
      const u = p.units[p.wheel[pos]];
      if (!Se(u)) continue;
      const x = u.fx;
      if (x.noLoafAll) f.noLoafAll = 1;
      if (x.noGuardAll) f.noGuardAll = 1;
      if (x.noEvade) f.noEvade = 1;
      if (x.noElemSkill) f.noElemSkill = 1;
      if (x.allUpAll) f.allUpAll = Math.max(f.allUpAll, x.allUpAll);
      if (x.loafDmg) f.loafDmg = Math.max(f.loafDmg, x.loafDmg);
      if (x.healDown) f.healDown = Math.max(f.healDown, x.healDown);
      if (x.poisonUp) f.poisonUp = Math.max(f.poisonUp, x.poisonUp);
      if (x.purifyHard) f.purifyHard[1 - pid] = Math.max(f.purifyHard[1 - pid], x.purifyHard);
      if (x.teamNoLoaf) f.teamNoLoaf[pid] = Math.max(f.teamNoLoaf[pid], x.teamNoLoaf);
      if (x.foeLoaf) f.foeLoaf[1 - pid] = Math.max(f.foeLoaf[1 - pid], x.foeLoaf);
      if (x.wheelLock) f.wheelLock[1 - pid] = 1;
      if (x.blessMagnet && f.blessMagnet === null) f.blessMagnet = u;
      if (x.atkBias) f.atkBias += x.atkBias; // 肉食オーラ・草食オーラ（両方いれば打ち消しあう）
      for (const k in x) {
        if (k.startsWith("weather_")) f.weather[k.slice(8)] = Math.max(f.weather[k.slice(8)] ?? 0, x[k]);
        else if (k.startsWith("campAura_")) f.camp[k.slice(9)] = Math.max(f.camp[k.slice(9)] ?? 0, x[k]);
      }
    }
  });
  return f;
}

// 属性の技：得意（adept）・装備（ムゲンすいとう）・受ける側の耐性
function elemMult(att, def, el) {
  let m = 1e3;
  const ad = att.fx["adept_" + el];
  if (ad) m = Bt(m, ad);
  const rs = def.fx["resist_" + el];
  if (rs && !att.fx.pierce) m = Bt(m, Math.max(100, 1e3 - rs));
  if (el === "water" && att.eq.waterUp) m = Bt(m, att.eq.waterUp);
  if (el === "water" && def.eq.waterGuard) m = Bt(m, def.eq.waterGuard);
  const w = (FIELD ?? EMPTY_FIELD).weather[el];
  if (w) m = Bt(m, 1e3 + w);
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
  const F = FIELD ?? EMPTY_FIELD;
  let p = def.loafPermil * (u.eq.loafMult ?? 1) * (u.fx.loafMult ?? 1) * F.foeLoaf[u.owner];
  if (u.curse?.kind === "lazy") p += [300, 500, 700][u.curse.tier];
  if (u.fx.noLoaf) p = Math.floor(p * Math.max(0, 1e3 - u.fx.noLoaf) / 1e3);
  if (F.teamNoLoaf[u.owner]) p = Math.floor(p * Math.max(0, 1e3 - F.teamNoLoaf[u.owner]) / 1e3);
  if (F.noLoafAll) p = 0;
  return Math.min(900, p);
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
  // どろぼう：相手の持ち物をとる
  if (att.fx.stealItem && !state.noItems && dp.bag.length && ap.bag.length < BAG_SIZE && gt(att.rng, 1e3) < att.fx.stealItem) {
    const it = dp.bag.splice(gt(att.rng, dp.bag.length), 1)[0];
    ap.bag.push(it);
    ev.push({ t: "steal", src: att.uid, dst: def.uid, item: it });
  }
}

// たおれたとき（Xa から）：前衛の味方へ
function onDeathFx(state, ev, p, dead) {
  // もえるとうし：味方が気絶すると ちからアップ（3 回まで）
  for (const u of Ht(p)) if (u !== dead && u.fx.allyKoAtk) addDyn(u, "atk", u.fx.allyKoAtk, u.fx.allyKoAtk * 3);
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
    case "revive": return !Se(u) && !noRevive(p);
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
  if (rv >= 0 && !noRevive(p)) for (const s of [0, 1, 2, 3, 4, 5]) if (!Se(p.units[p.wheel[s]])) return { t: "item", slot: rv, allySlot: s };
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

// ---- とりつき（本家に合わせる） ----
// 悪いとりつき：時間では消えない。おはらい（または厄除けのよいとりつき・復活）でだけ消える。
//   とりつかれている間は奥義を撃てない。構えている最中にとりつかれたら構えは解ける。
// よいとりつき：とりつかれた妖怪が行動するたびに 1 ターン減り、0 で消える。
var BLESS_TURNS = [3, 4, 5];   // 小・中・大
var KO_WAIT = 32, KO_WAIT_ULT = 56; // 前衛が全滅したとき、倒れる演出が終わるまで回さない（tick）

function purifySpeed(u) {
  const hard = (FIELD ?? EMPTY_FIELD).purifyHard[u.owner]; // こじらせ：相手のおはらいが難しくなる
  return Math.floor((1e3 + (u.fx.purifyFast ?? 0) + (u.fx.curseShort ?? 0)) * (1e3 - hard) / 1e3);
}

function blessTurns(u, tier) {
  return Math.max(1, Math.round(BLESS_TURNS[tier] * (1e3 + (u.fx.blessLong ?? 0)) / 1e3));
}

// 行動し終えたとき。その行動でついたよいとりつきは数えない
function blessTurnPassed(u, ev) {
  const b = u.blessing;
  if (!b || !Se(u)) return;
  if (b.fresh) { b.fresh = !1; return; }
  if (--b.turns <= 0) {
    u.blessing = null;
    ev.push({ t: "blessEnd", uid: u.uid });
  }
}

function cancelStanceIfCursed(p, u, ev) {
  const s = p.stance;
  if (!s || !(s.unit === u.index || s.partners.includes(u.index))) return;
  const w = p.units[s.unit];
  Se(w) && (w.ultLockout = Cc);
  p.stance = null;
  ev.push({ t: "stanceCancel", player: u.owner, uid: w.uid, grand: s.grand, reason: "curse" });
}

// 多段の技：ダメージの出来事に何回に分けて当たるかを書く（画面で 1 発ずつ見せる）
function markHits(ev, from, att, source) {
  const d = ct[att.defIndex];
  const n = source === "attack" ? d.attackHits : source === "skill" ? d.skillHits : source === "ult" ? d.ultHits : 0;
  if (!n || n < 2) return;
  for (let k = from; k < ev.length; k++) if (ev[k].t === "damage" && ev[k].src === att.uid) { ev[k].hits = n; return; }
}

// ---- 本家のスキルの部品 ----
function addDyn(u, stat, v, cap) {
  u.dyn ??= {};
  u.dyn[stat] = Math.min(cap, (u.dyn[stat] ?? 0) + v);
}
function noRevive(p) {
  return p.units.some(u => u.fx.noRevive);
}

// ねらわれる相手を選ぶときに外す（おんみつ・よいとりつき「ねらわれない」）
function untargetable(u) {
  return !!(u.fx.hideFull || u.blessing?.kind === "hide");
}

// こうげきの属性（大地の砲・火の魂など）
function attackElement(u) {
  for (const e of ["fire", "water", "thunder", "earth", "ice", "wind"]) if (u.fx["atkElem_" + e]) return e;
  return null;
}
// ようじゅつの属性（れんごく魂などで変わる。うんちく・無の魂で無属性）
function skillElementOf(u, def) {
  if ((FIELD ?? EMPTY_FIELD).noElemSkill) return null;
  for (const e of ["fire", "water", "thunder", "earth", "ice", "wind"]) if (u.fx["magic_" + e]) return e;
  return def.skillElement;
}
function skillPowerOf(u, def) {
  for (const e of ["fire", "water", "thunder", "earth", "ice", "wind"]) if (u.fx["magic_" + e]) return Math.max(def.skillPower, 120);
  return def.skillPower;
}
// 避雷針・防火壁など：その属性のようじゅつを前衛で受け止める妖怪
function rodCatcher(p, el) {
  if (!el) return null;
  return Ht(p).find(u => u.fx["rod_" + el]) ?? null;
}

// ようじゅつ「回復の術」：いちばん HP の減った前衛の味方を回復（きずなめ：同時におはらい、超回復：大ピンチなら多く）
function skillHeal(state, ev, p, u, def) {
  const list = Ht(p);
  if (!list.length) return;
  const t = list.reduce((a, b) => mr(b) < mr(a) ? b : a);
  let g = Math.floor((Jt(p, u, "spa") + def.skillPower) / 2);
  g = Bt(g, 1e3 + (u.fx.healUp ?? 0)), g = Bt(g, 1e3 - (FIELD ?? EMPTY_FIELD).healDown);
  if (u.fx.bigHealPinch && t.hp * 4 <= t.maxHp) g *= 2;
  g = Bt(g, Xn(u.rng, tu, au));
  $a(ev, t, g, u.uid);
  if (u.fx.healPurify && t.curse && gt(u.rng, 1e3) < u.fx.healPurify) t.curse = null, ev.push({ t: "curseCleared", uid: t.uid, by: "trait" });
}

// 行動し終えたあと（Zh から）：あかなめ・シャッフル・吸血マニア
function afterAction(state, pid, u, ev) {
  if (!Se(u)) return;
  const p = state.players[pid];
  if (u.fx.autoPurify && gt(u.rng, 1e3) < u.fx.autoPurify) {
    const c = p.units.filter(x => Se(x) && x.curse);
    if (c.length) { const x = c[gt(u.rng, c.length)]; x.curse = null; ev.push({ t: "curseCleared", uid: x.uid, by: "trait" }); }
  }
  if (u.fx.leech) for (const nb of jn(p, u)) {
    if (!Se(nb) || nb.hp <= 1) continue;
    const v = Math.min(nb.hp - 1, Math.max(1, Math.floor(nb.maxHp * u.fx.leech / 1e3)));
    nb.hp -= v, ev.push({ t: "damage", src: u.uid, dst: nb.uid, amount: v, source: "trait", crit: !1 });
    $a(ev, u, v, u.uid);
  }
  if (u.fx.shuffle && gt(u.rng, 1e3) < u.fx.shuffle) {
    for (const q of [0, 1]) {
      const pl = state.players[q], k = 1 + gt(u.rng, 5), w = pl.wheel, nw = new Array(6);
      for (let d = 0; d < 6; d++) nw[(d + k) % 6] = w[d];
      pl.wheel = nw;
      ev.push({ t: "rotate", player: q, dir: "cw", steps: k, by: "shuffle" });
      Pu(pl, ev);
      if (pl.stance && !Vt(pl, pl.stance.unit)) Ii(state, q, ev, "rotate");
      if (pl.purify && Vt(pl, pl.purify.unit)) pl.purify = null;
    }
  }
}

// さぼったとき（Jh から）
function onLoaf(state, p, u, ev) {
  if (u.fx.loafHeal) $a(ev, u, healAmt(u, u.maxHp, u.fx.loafHeal), u.uid);
  if (u.fx.loafHealAlly) {
    const list = Ht(p).filter(x => x !== u);
    if (list.length) { const t = list.reduce((a, b) => mr(b) < mr(a) ? b : a); $a(ev, t, healAmt(u, t.maxHp, u.fx.loafHealAlly), u.uid); }
  }
  const ld = (FIELD ?? EMPTY_FIELD).loafDmg;
  if (ld) Xa(state, ev, p, u, Math.max(1, Math.floor(u.maxHp * ld / 1e3)), null, "trait", !1);
}

// たおれそうなとき（Xa から）：こらえる・りふじん。たおれずに済んだら true
function honkeSurvive(state, ev, p, u, amount, source) {
  if (u.hp - amount > 0) return !1;
  if (u.fx.endureChance && gt(u.rng, 1e3) < u.fx.endureChance) {
    u.hp = 1, ev.push({ t: "endure", uid: u.uid });
    return !0;
  }
  if (u.fx.swapDeath && !u.swapUsed && Vt(p, u.index)) {
    const nb = jn(p, u).find(x => Se(x) && x !== u);
    if (nb) {
      u.swapUsed = !0, u.hp = Math.max(1, Math.floor(u.maxHp / 2));
      ev.push({ t: "cover", from: u.uid, to: nb.uid });
      Xa(state, ev, p, nb, nb.hp, u.uid, "trait", !1);
      ev.push({ t: "heal", src: u.uid, dst: u.uid, amount: u.hp });
      return !0;
    }
  }
  return !1;
}
// ダメージを受けたあと：おにぎり（ピンチで 1 度だけ回復）
function afterDamaged(ev, u) {
  if (Se(u) && u.fx.pinchHeal && !u.pinchUsed && u.hp * 4 <= u.maxHp) {
    u.pinchUsed = !0;
    $a(ev, u, Math.floor(u.maxHp * u.fx.pinchHeal / 1e3), u.uid);
  }
}

// こうげき・ようじゅつをよける確率（‰）
function evadeChance(att, def, source) {
  if ((FIELD ?? EMPTY_FIELD).noEvade || att.fx.sureHit) return 0;
  let v = (def.fx.evade ?? 0) + (source === "skill" ? def.fx.evadeSkill ?? 0 : 0);
  if (att.fx.accuracy) v = Math.floor(v * Math.max(0, 1e3 - att.fx.accuracy) / 1e3);
  return v;
}
// ガード中のダメージ倍率（つぼガード・ガードの効果を受けにくい）
function guardMult(att, def) {
  const m = def.fx.ironGuard ?? wc;
  return att.fx.guardPierce ? m + Math.floor((1e3 - m) * Math.min(1e3, att.fx.guardPierce) / 1e3) : m;
}
