// ============================================================================
// 1 体ぶんの持ち物（性格・装備／魂・努力）から、対戦で使う能力値と効果をまとめる。
// 編成画面の「確認」表示と、対戦開始のどちらもここを通すので、見えている数字がそのまま使われる。
// ============================================================================

var SOUL_PREFIX = "soul:";

function equipById(id) {
  if (id == null) return null;
  if (id.startsWith(SOUL_PREFIX)) {
    const d = ct.find(x => x.id === id.slice(SOUL_PREFIX.length));
    if (!d) return null;
    const t = traitOf(d);
    return { id, name: t.soulName, cat: "魂", mods: t.soulMods ?? {}, special: null, only: null, honke: true, soulOf: d.id, fx: t.soulFx, desc: t.soulDesc };
  }
  return Ni.find(x => x.id === id) ?? null;
}

function equipAllowed(def, id) {
  const e = equipById(id);
  if (!e) return false;
  if (!e.only) return true;
  return EQUIP_ONLY[e.only].test(def);
}

function equipDesc(e) {
  if (!e) return "";
  if (e.cat === "魂" || e.cat === "レア魂") return e.desc + (e.mods && Object.keys(e.mods).length ? "" : "");
  const parts = Object.entries(e.mods).map(([k, v]) => `${STAT_JA[k]}${v > 0 ? "+" : ""}${v}`);
  const s = e.special ?? {};
  if (s.sgRate) parts.push(`妖気のたまり方+${s.sgRate / 10}%`);
  if (s.curseHalf) parts.push("おはらいされる速さ+50%");
  if (s.doll) parts.push("たおれるダメージを 1 回だけ HP1 でこらえる");
  if (s.noLoaf) parts.push("サボらない");
  if (s.waterUp) parts.push("水の技の威力アップ・水の技に強くなる");
  if (s.vsCamp) parts.push(`${CAMP_JA[s.vsCamp]}の妖怪へのダメージ 1.25 倍`);
  if (s.vsMaga) parts.push("禍族（本家：怪魔）へのダメージ 2 倍、ほかの妖怪へは 0.8 倍");
  if (s.critTaken) parts.push("クリティカルを受けやすくなる");
  if (s.cursedAllDown) parts.push("悪いとりつきにかかると全能力ダウン");
  if (s.loafMult) parts.push("サボりやすくなる");
  if (s.allMult) parts.push("全能力が大きく下がる（半分）");
  if (s.noBattleEffect) parts.push(s.noBattleEffect);
  if (e.only) parts.push(EQUIP_ONLY[e.only].label);
  return parts.join("・");
}

function mergeFx(...list) {
  const out = {};
  for (const fx of list) {
    if (!fx) continue;
    for (const [k, v] of Object.entries(fx)) {
      if (k.startsWith("adept_")) out[k] = Math.max(out[k] ?? 1000, 1000) + (v - 1000);
      else if (k === "ironGuard") out[k] = Math.min(out[k] ?? 500, v);
      else if (k === "rageAt") out[k] = Math.max(out[k] ?? 0, v);
      else if (k === "critEye") out[k] = Math.max(out[k] ?? 0, v);
      else if (k === "ultEvade") out[k] = Math.min(1000, (out[k] ?? 0) + v);
      else out[k] = (out[k] ?? 0) + v;
    }
  }
  return out;
}

// member: { unit, nature?, effort?, equipment? }
function memberStats(member) {
  const d = ct.find(x => x.id === member.unit);
  const r = member.effort ?? xu;
  const e = equipById(member.equipment ?? null);
  const mods = e?.mods ?? {};
  const sp = e?.special ?? {};
  const base = {
    maxHp: d.hp + r.hp * wh + (mods.hp ?? 0),
    atk: d.atk + r.atk + (mods.atk ?? 0),
    spa: d.spa + r.spa + (mods.spa ?? 0),
    def: d.def + r.def + (mods.def ?? 0),
    spd: d.spd + r.spd + (mods.spd ?? 0),
  };
  if (sp.allMult) for (const k of Object.keys(base)) base[k] = Math.floor(base[k] * sp.allMult / 1000);
  for (const k of Object.keys(base)) base[k] = Math.max(1, base[k]);
  const eqFx = {};
  if (sp.sgRate) eqFx.sgRate = sp.sgRate;
  if (sp.noLoaf) eqFx.noLoaf = 1000;
  if (sp.curseHalf) eqFx.curseShort = 500;
  const fx = mergeFx(traitOf(d).fx, e?.fx, eqFx);
  return {
    ...base,
    nature: member.nature ?? d.defaultNature,
    equipment: e ? e.id : null,
    eq: sp,
    fx,
    favorite: favoriteOf(d),
    camp: campOf(d),
  };
}

function validBag(bag) {
  if (!Array.isArray(bag)) return [];
  return bag.filter(id => battleItem(id)).slice(0, BAG_SIZE);
}

// 装備できるもの一覧（編成画面・CPU 用）。魂は全員ぶん。
function equipChoices(def) {
  const list = Ni.filter(e => equipAllowed(def, e.id));
  return list;
}
function soulChoices() {
  return ct.filter(d => !(d.trait === "honke" && !d.soulText)).map(d => equipById(SOUL_PREFIX + d.id));
}

// CPU のための持ち物（回復多め、漢方 1 つ、たまに妖気・おふだ）
function randomBag(rng) {
  const heals = BATTLE_ITEMS.filter(x => x.kind === "heal" && x.amount >= 60 && x.amount <= 240);
  const souls = BATTLE_ITEMS.filter(x => x.kind === "soul" && x.amount >= 50);
  const tal = BATTLE_ITEMS.filter(x => x.kind === "talisman");
  const bag = [];
  for (let i = 0; i < 3; i++) bag.push(heals[gt(rng, heals.length)].id);
  bag.push(["mazui_kanpou", "nigai_kanpou", "fukai_kanpou"][gt(rng, 3)]);
  bag.push(souls[gt(rng, souls.length)].id);
  bag.push(tal[gt(rng, tal.length)].id);
  return bag;
}

// CPU の装備えらび：本家の装備・このゲームの装備・魂からランダム（装備できるものだけ）
function randomEquip(rng, def) {
  const r = gt(rng, 10);
  if (r === 0) return null;
  if (r <= 2) { const s = soulChoices(); return s[gt(rng, s.length)].id; }
  const list = equipChoices(def).filter(e => !e.special?.allMult && !e.special?.noBattleEffect);
  return list[gt(rng, list.length)].id;
}
