// ============================================================================
// 特性（本家のスキル）の説明文と、元祖軍／本家軍・好物。
// 妖怪は本家の妖怪だけなので、特性は本家のスキル（効果は honke_roster.js の HONKE_SKILL_FX）。
// 数値はすべて‰（1000 分率）か固定値。対戦ロジックは unit.fx を読む。
// ============================================================================

var TRIBE_JA = { takeru: "猛", ayashi: "怪", tsuwamono: "剛", kage: "影", nagomi: "和", miyabi: "雅", tatari: "祟", shizume: "鎮", maga: "禍" };
var ELEM_JA = { fire: "火", water: "水", thunder: "雷", earth: "土", ice: "氷", wind: "風" };
var CURSE_JA = { slow: "鈍重", weaken: "衰弱", brittle: "脆化", poison: "蝕毒", seal: "封気", stun: "行動停止", confuse: "混乱", allDown: "全能力低下", lazy: "怠け", money: "散財" };

// 効果キー → 説明文
function fxLine(k, v) {
  const pct = x => `${Math.round(x / 10)}%`;
  const [head, arg] = k.includes("_") ? k.split(/_(.+)/) : [k, null];
  switch (head) {
    case "rage": return null; // rageAt とまとめて書く
    case "rageAt": return null;
    case "guardBreak": return "こうげきが相手のガードを無視する";
    case "keystone": return `前衛のまん中にいると まもり+${pct(v)}`;
    case "adept": return `${ELEM_JA[arg]}の技の威力 ×${(v / 1000).toFixed(2)}`;
    case "endure": return v >= 2 ? "たおれるダメージを 2 回まで HP1 でこらえる" : "たおれるダメージを 1 回だけ HP1 でこらえる";
    case "tailwind": return `後衛にいると 前衛の味方のすばやさ+${pct(v)}`;
    case "devour": return `相手をたおすと HP を ${pct(v)} 回復`;
    case "grudge": return `たおされると 相手に その相手の最大HPの ${pct(v)} のダメージ`;
    case "curseMaster": return "味方全員の悪いとりつきが 1 段階強くなる";
    case "curseHit": return `悪いとりつきが当たりやすい（+${pct(v)}）`;
    case "unbreakable": return "悪いとりつきを受けない";
    case "thorns": return `こうげきを受けると 相手に ${pct(v)} を返す`;
    case "mirror": return `ようじゅつを受けると 相手に ${pct(v)} を返す`;
    case "ironGuard": return `ガード中のダメージが ${pct(v)} になる（通常 50%）`;
    case "drain": return `こうげき・ようじゅつで与えたダメージの ${pct(v)} を吸いとる`;
    case "waterEater": return "水の技を受けると HP が回復する";
    case "hidden": return "相手からねらわれにくい（ねらう指定がないと選ばれない）";
    case "firstStrike": return "前衛に出たとき 最初の 1 回はすぐ行動する";
    case "spiritSmoke": return `となりの味方の妖気のたまり方+${pct(v)}`;
    case "prayer": return `となりの味方が行動すると その味方の HP を ${pct(v)} 回復`;
    case "benchHeal": return `後衛にいると 行動した前衛の味方の HP を ${pct(v)} 回復`;
    case "conqueror": return `相手をたおすたび ちから+${pct(v)}（3 回まで）`;
    case "critEye": return `クリティカル率アップ（${Math.round(v * 100 / 64)}%）`;
    case "ultEvade": return v >= 1000 ? "相手のひっさつわざを必ずかわす" : `相手のひっさつわざを ${pct(v)} でかわす`;
    case "scapegoat": return "ねらわれると となりの前衛の味方に代わってもらう";
    case "guardian": return "たおれそうな前衛の味方をかばう";
    case "relay": return `行動すると となりの前衛の味方の番が ${pct(v)} 早く来る`;
    case "oil": return `チームにいると ホイールを回したあとの待ち時間-${pct(v)}`;
    case "up": return `${STAT_JA[arg]}+${pct(v)}`;
    case "atkUp": return `こうげきの威力+${pct(v)}`;
    case "skillUp": return `ようじゅつの威力+${pct(v)}`;
    case "ultUp": return `ひっさつわざの威力+${pct(v)}`;
    case "healUp": return `回復するひっさつわざ・特性の回復量+${pct(v)}`;
    case "hitSg": return `ダメージを受けると 妖気+${v}`;
    case "killSg": return `相手をたおすと 妖気+${v}`;
    case "regen": return `行動するたび HP を ${pct(v)} 回復`;
    case "startSg": return `妖気 ${v} から始める`;
    case "sgRate": return `妖気のたまり方+${pct(v)}`;
    case "sgSteal": return `こうげきが当たると 相手の妖気を ${v} うばう`;
    case "critDmg": return `クリティカルのダメージ+${pct(v)}`;
    case "vsCursed": return `とりつかれ・サボり中の相手へのダメージ+${pct(v)}`;
    case "vsTribe": return `${TRIBE_JA[arg]}族へのダメージ+${pct(v)}`;
    case "inflict": return `こうげきが当たると ${pct(v)} で相手を${CURSE_JA[arg]}にする`;
    case "counter": return `こうげきを受けると ${pct(v)} で相手を${CURSE_JA[arg]}にする`;
    case "resist": return `${ELEM_JA[arg]}の技のダメージ-${pct(v)}`;
    case "guardHeal": return `ガードすると HP を ${pct(v)} 回復`;
    case "foodUp": return `たべものの回復量+${pct(v)}`;
    case "noLoaf": return v >= 1000 ? "サボらない" : `サボりにくい（-${pct(v)}）`;
    case "lowDef": return `HP が半分以下のとき まもり+${pct(v)}`;
    case "spdLow": return `HP が半分以下のとき すばやさ+${pct(v)}`;
    case "deathSg": return `たおれると 前衛の味方の妖気+${v}`;
    case "deathHeal": return `たおれると 前衛の味方の HP を ${pct(v)} 回復`;
    case "blessLong": return `よいとりつきが長もち（+${pct(v)}）`;
    case "curseResist": return `悪いとりつきを ${pct(v)} でふせぐ`;
    case "curseShort": return `悪いとりつきをはらいやすい（おはらい+${pct(v)}）`;
    case "purifyFast": return `おはらいされる速さ+${pct(v)}`;
    case "evade": return `こうげき・ようじゅつを ${pct(v)} でかわす`;
    case "benchSg": return `後衛にいると 味方が行動するたび 妖気+${v}`;
    case "benchRegen": return `後衛にいると 味方が行動するたび HP を ${pct(v)} 回復`;
    // 本家のスキル・魂・レア魂
    case "noBattle": return null;
    case "taunt": return "いつも相手のこうげき・ようじゅつを引きつける（ねらう指定より先。全体わざはのぞく）";
    case "hideFull": return "前衛にほかの味方がいる間は ねらわれない";
    case "guardOnly": return "ガードしかしない";
    case "blocker": return "前衛に出るとき ガードしながら出る";
    case "pierce": return "相手の耐性（得意な属性）を無視してダメージを与える";
    case "sureHit": return "こうげき・ようじゅつが かわされない";
    case "accuracy": return `相手にかわされにくい（-${pct(v)}）`;
    case "evadeSkill": return `ようじゅつを ${pct(v)} でかわす`;
    case "evadeCounter": return "こうげきをかわすと 反撃する";
    case "critTaken": return `クリティカルを受けやすい（×${v}）`;
    case "noCritTaken": return "クリティカルを受けない";
    case "critDefUp": return `クリティカルを受けると まもり+${pct(v)}（${pct(v * 3)} まで）`;
    case "cursedAllDown": return `悪いとりつき中は 全能力-${pct(v)}`;
    case "cursedAllUp": return `悪いとりつき中は 全能力+${pct(v)}`;
    case "cursedHeal": return `悪いとりつきを受けると HP を ${pct(v)} 回復`;
    case "curseSure": return "悪いとりつきが必ず当たる";
    case "curseReflect": return "悪いとりつきを 相手にはね返す";
    case "autoPurify": return `行動すると ${pct(v)} で味方 1 体の悪いとりつきをはらう`;
    case "friendlyFire": return `${pct(v)} で味方をこうげきしてしまう`;
    case "conqSpa": return "相手をたおすたび ようりょくも上がる";
    case "pinchHeal": return `HP が 25% 以下になると 1 度だけ HP を ${pct(v)} 回復`;
    case "bigHealPinch": return "回復の術で HP 25% 以下の味方を 2 倍回復";
    case "healPurify": return `回復の術で ${pct(v)} で おはらいもする`;
    case "guardNoWeak": return "ガード中は 弱点の属性でもダメージがふえない";
    case "guardPierce": return `相手のガードを ${pct(v)} つらぬく`;
    case "guardThorns": return `ガード中にこうげきを受けると 相手に ${pct(v)} を返す`;
    case "guardMirror": return "ガード中は ようじゅつを相手にはね返す";
    case "resistAttack": return `こうげきのダメージ-${pct(v)}`;
    case "halfAttack": return "こうげきのダメージを半分にする";
    case "allyKoAtk": return `味方がたおれると ちから+${pct(v)}（${pct(v * 3)} まで）`;
    case "noLoafAll": return "前衛にいる間 敵味方全員がサボらない";
    case "teamNoLoaf": return `前衛にいる間 味方がサボりにくい（-${pct(v)}）`;
    case "foeLoaf": return `前衛にいる間 相手が ${v} 倍サボりやすい`;
    case "loafMult": return `${v} 倍サボりやすい`;
    case "loafHeal": return `サボると HP を ${pct(v)} 回復`;
    case "loafHealAlly": return `サボると HP のいちばん少ない前衛の味方を ${pct(v)} 回復`;
    case "loafDmg": return `前衛にいる間 サボった妖怪に 最大HPの ${pct(v)} のダメージ`;
    case "noGuardAll": return "前衛にいる間 敵味方全員がガードしない";
    case "noEvade": return "前衛にいる間 敵味方全員がかわせない";
    case "noElemSkill": return "前衛にいる間 敵味方全員のようじゅつが無属性になる";
    case "allUpAll": return `前衛にいる間 敵味方全員の能力+${pct(v)}`;
    case "healDown": return `前衛にいる間 敵味方全員の回復量-${pct(v)}`;
    case "poisonUp": return `前衛にいる間 毒のダメージ+${pct(v)}`;
    case "purifyHard": return `前衛にいる間 相手のおはらいが ${pct(v)} おそくなる`;
    case "wheelLock": return "前衛にいる間 相手はホイールを回せない";
    case "oilFree": return "相手にホイールを止められても 回せる";
    case "thunderDefUp": return `雷の技を受けると まもり+${pct(v)}`;
    case "sameSkillUp": return `となりに同じスキルの妖怪がいると 能力+${pct(v)}`;
    case "pairA": return `となりに「うん」の妖怪がいると ようりょく+${pct(v)}`;
    case "lone": return `となりの前衛に味方がいないと ちから+${pct(v)}`;
    case "night": return `対戦の後半は 能力+${pct(v)}`;
    case "sgPower": return `妖気がたまっているほど ちから・ようりょくアップ（最大+${pct(v)}）`;
    case "drainUp": return `吸いとる量+${pct(v)}`;
    case "leech": return `行動すると となりの味方の HP を ${pct(v)} 吸いとる`;
    case "shuffle": return `行動すると ${pct(v)} で 敵味方のホイールをバラバラに回す`;
    case "stealItem": return `こうげきが当たると ${pct(v)} で相手のアイテムをとる`;
    case "swapDeath": return "たおれそうになると 1 度だけ となりの味方と入れかわる（味方がかわりにたおれる）";
    case "endureChance": return `たおれるダメージを ${pct(v)} で HP1 でこらえる`;
    case "noRevive": return "味方は対戦中 復活できない";
    case "halfTurn": return "2 回に 1 回しか行動しない";
    case "atkBias": return v > 0 ? `前衛にいる間 敵味方全員が こうげきを選びやすい（+${pct(v)}）` : `前衛にいる間 敵味方全員が こうげきを選びにくい（-${pct(-v)}）`;
    case "skillAll": return "ようじゅつが 敵の前衛全員に当たる";
    case "blessMagnet": return "前衛にいる間 敵味方のよいとりつきを 全部自分に向けさせる";
    case "atkElem": return `こうげきが${ELEM_JA[arg]}属性になる`;
    case "magic": return `ようじゅつが${ELEM_JA[arg]}属性（威力 120 以上）になる`;
    case "rod": return `${ELEM_JA[arg]}のようじゅつを 前衛で引き受ける`;
    case "weather": return `前衛にいる間 ${ELEM_JA[arg]}の技の威力+${pct(v)}`;
    case "center": return `前衛のまん中にいると ${arg === "all" ? "全能力" : STAT_JA[arg]}+${pct(v)}`;
    case "aura": return `となりの味方の${arg === "all" ? "全能力" : STAT_JA[arg]}+${pct(v)}`;
    case "campAura": { const [camp, st] = arg.split("_"); return `前衛にいる間 ${CAMP_JA[camp]}の妖怪の${STAT_JA[st]}+${pct(v)}`; }
  }
  return `${k} ${v}`;
}

function fxDesc(fx) {
  const out = [];
  if (fx.rage) out.push(`HP が ${Math.round((fx.rageAt ?? 250) / 10)}% 以下のとき ちから+${Math.round(fx.rage / 10)}%`);
  for (const [k, v] of Object.entries(fx)) {
    const s = fxLine(k, v);
    if (s) out.push(s);
  }
  return out.join("。");
}

var TRAIT_TABLE = new Map();
function buildTraits() {
  for (const d of ct) TRAIT_TABLE.set(d.id, honkeTrait(d));
}

function traitOf(def) {
  return TRAIT_TABLE.get(def.id);
}

// ---- 元祖軍 / 本家軍、好物（本家のデータ。書かれていない妖怪は、好物なし・どちらの軍でもない） ----
function hash32(s) {
  let t = 2166136261;
  for (let i = 0; i < s.length; i++) t = Math.imul(t ^ s.charCodeAt(i), 16777619);
  return t >>> 0;
}
function favoriteOf(def) {
  return def.fav ?? null;
}
function campOf(def) {
  return def.camp ?? null;
}
var CAMP_JA = { ganso: "元祖軍", honke: "本家軍" };
