// ============================================================================
// 本家（妖怪ウォッチ2 元祖/本家/真打）の妖怪を足す（データは honke_roster_data.js。tools/gen_honke.py が作る）。
//   ・能力値は本家の Lv60、ランク・種族（陣の効果が同じ族へ）・こうげき（段数）・ようじゅつ・とりつき・必殺技は本家どおり
//   ・スキル（特性）も本家の名前と効果。本家の妖怪どうしは同じスキルを持つことがある（本家と同じ）
//   ・魂は本家の「○○の魂」の効果。2 つの魂からできる「レア魂」（ちょうはつ魂など 27 種）は持ち物として選べる
// 数値はすべて‰（1000 分率）か回数。対戦ロジックは unit.fx を読む（engine_fx.js）。
// ============================================================================

// 本家のスキル → このゲームでの効果
var HONKE_SKILL_FX = {
  "ぶようじん": { critTaken: 4 },
  "やいばのボディー": { thorns: 250 }, "しかえし": { thorns: 250 }, "さめはだ": { thorns: 250 }, "ツッコミ": { thorns: 300 },
  "きれいずき": { cursedAllDown: 300 },
  "むしゃくしゃ": { friendlyFire: 200 }, "うらやめし〜": { friendlyFire: 200 }, "うたがいのめ": { friendlyFire: 200 }, "自己中": { friendlyFire: 200 }, "ギスギス": { friendlyFire: 200 },
  "かたながり": { conqueror: 150, conqSpa: 1 }, "まえのめり": { conqueror: 150 }, "大将": { conqueror: 250 },
  "もちはだ": { critDefUp: 300 },
  "あかなめ": { autoPurify: 300 },
  "おにぎり": { pinchHeal: 400 },
  "ゆうたいガード": { guardNoWeak: 1 },
  "おんねん": { grudge: 250 },
  "もえるとうし": { allyKoAtk: 200 }, "ふるえるとうし": { allyKoAtk: 200 }, "かがやくとうし": { allyKoAtk: 200 },
  "ギャンブラー": { critEye: 12, critTaken: 3 }, "ふあんてい": { critEye: 12, critTaken: 3 }, "ノーガード": { critEye: 12, critTaken: 3 },
  "いっせん": { critEye: 16 },
  "のろいのおはだ": { cursedAllUp: 300 },
  "ガードくずし": { guardBreak: 1 }, "8枚舌": { guardBreak: 1 },
  "どひょうぎわ": { endure: 1 }, "がまん": { endure: 1 },
  "いあつかん": { noLoafAll: 1 },
  "妖怪食い": { devour: 250 }, "魂食い": { devour: 250 },
  "追い風ふかし": { tailwind: 150 },
  "水あそび": { adept_water: 1200 }, "雪あそび": { adept_ice: 1200 }, "雷あそび": { adept_thunder: 1200 }, "火あそび": { adept_fire: 1200 }, "風あそび": { adept_wind: 1200 },
  "木魚のリズム": { foeLoaf: 3 },
  "まもりわすれ": { noGuardAll: 1 },
  "元祖のきずな": { campAura_ganso_def: 150 }, "本家のちかい": { campAura_honke_spd: 150 },
  "おれないハート": { unbreakable: 1 }, "きせきのりんぷん": { unbreakable: 1 }, "ふっさふさ": { unbreakable: 1 }, "しんぴのウロコ": { unbreakable: 1 }, "む敵のこうら": { unbreakable: 1 },
  "おせわ": { prayer: 15 }, "らくてんパワー": { prayer: 15 }, "おいのり": { prayer: 15 }, "ざわわ": { prayer: 15 }, "おでんの香り": { prayer: 25 }, "光オーラ": { prayer: 25 },
  "どりょくか": { noBattle: 1 }, "モテモテ": { noBattle: 1 }, "モテマテン": { noBattle: 1 }, "モノマネ": { noBattle: 1 }, "こううん": { noBattle: 1 },
  "ネコババ": { noBattle: 1 }, "げきうん": { noBattle: 1 }, "よくぼう": { noBattle: 1 }, "よびよせ": { noBattle: 1 },
  "謝罪": { loafHealAlly: 150 },
  "妖気のけむり": { spiritSmoke: 400 },
  "ながもち": { blessLong: 600 },
  "電磁フィールド": { thunderDefUp: 500 },
  "ナンバーワン！": { center_spd: 250 }, "におうだち": { center_def: 300 }, "わしじゃ": { center_all: 150 },
  "ミラーボディー": { mirror: 500 },
  "兄弟のちかい": { sameSkillUp: 100 }, "じんめんパラダイス": { sameSkillUp: 100 }, "じゅずつなぎ": { sameSkillUp: 100 },
  "かんつう": { pierce: 1 },
  "きゅうかく": { sureHit: 1 }, "しりょくA": { sureHit: 1 }, "目目目": { sureHit: 1 },
  "閃光": { firstStrike: 1 }, "爆速": { firstStrike: 1 }, "せっかち": { firstStrike: 1 },
  "こっなごな": { noRevive: 1 },
  "つやつやボディー": { noCritTaken: 1 }, "ながい首": { noCritTaken: 1 },
  "土がくれ": { resist_earth: 400 }, "砂丘": { resist_earth: 400 }, "ぜつえんたい": { resist_thunder: 400 }, "火のようじん": { resist_fire: 400 },
  "かぜよけ": { resist_wind: 400 }, "しめったおはだ": { resist_water: 400 }, "ぼうすい": { resist_water: 400 }, "かちかちおはだ": { resist_ice: 400 },
  "ブロンズガード": { resist_earth: 300, resist_wind: 300 }, "シルバーガード": { resist_fire: 300, resist_ice: 300 },
  "ゴールドガード": { resist_thunder: 300, resist_water: 300 }, "プラチナガード": { resist_water: 250, resist_ice: 250, resist_wind: 250 },
  "大地の砲": { atkElem_earth: 1 }, "氷の牙": { atkElem_ice: 1 }, "雷の拳": { atkElem_thunder: 1 }, "大噴火": { atkElem_fire: 1 },
  "ブロッカー": { blocker: 1 },
  "避雷針": { rod_thunder: 1 }, "アイスブロック": { rod_ice: 1 }, "すいとる風": { rod_wind: 1 }, "防火壁": { rod_fire: 1 },
  "闘将": { lone: 300 },
  "めぐみのからだ": { deathHeal: 250 },
  "ガマのまもり": { guardian: 1 },
  "ひかえめ": { hidden: 1 }, "おんみつ": { hidden: 1, hideFull: 1 },
  "シャッフル": { shuffle: 200 },
  "とげガード": { guardThorns: 400 },
  "リーゼント": { resistAttack: 200 },
  "さぼりじょうず": { loafHeal: 150 }, "みちくさくい": { loafHeal: 150 },
  "「あ」": { pairA: 500 },
  "はなさない！": { drainUp: 500 }, "闇の支配": { drainUp: 500 },
  "大雨": { weather_water: 250 }, "炎天下": { weather_fire: 250 },
  "ホース": { evadeSkill: 500 }, "かれいなステップ": { evadeSkill: 500 }, "友情のガッツ": { evadeSkill: 500 },
  "ひらひらボディー": { evade: 350 }, "勝利のガッツ": { evade: 350 }, "未来予知": { evade: 150 }, "おならフィールド": { evade: 150 },
  "ワカメダンシング": { aura_atk: 150 },
  "きずなめ": { healPurify: 400 },
  "すなお": { noLoaf: 1000 }, "くそまじめ": { noLoaf: 1000 },
  "から傘シールド": { guardMirror: 1 },
  "アクロバット": { evade: 80, evadeCounter: 1 },
  "どんどんフィールド": { allUpAll: 150 },
  "スパルタ": { teamNoLoaf: 700 },
  "超回復": { bigHealPinch: 1 },
  "超クリティカル": { critDmg: 750 },
  "深夜テンション": { night: 250 },
  "きゅうけつ": { drain: 250 },
  "どろぼう": { stealItem: 200 }, "ものかくし": { stealItem: 200 },
  "黄泉フィールド": { healDown: 500 },
  "りふじん": { swapDeath: 1 },
  "吸血マニア": { leech: 30 },
  "ビビりすぎ": { loafMult: 4 },
  "きゅうきょくのヤミ": { curseSure: 1 }, "はなほじり": { curseSure: 1 },
  "さわぎたて": { poisonUp: 500 },
  "つやっつや": { curseReflect: 1 },
  "まわSEN": { wheelLock: 1 },
  "かたすかし": { ultImmune: 1 }, "ダークガード": { ultImmune: 1 },
  "呪いの天才": { curseMaster: 1 },
  "メタボボディー": { halfAttack: 1 },
  "老いゾーン": { noEvade: 1 },
  "ねちがえ": { loafDmg: 100 },
  "こじらせ": { purifyHard: 500 },
  "つぼガード": { ironGuard: 150 },
  "ドラゴンパワー": { rage: 600, rageAt: 300 },
  "保留": { halfTurn: 1 }, "ふかいねむり": { halfTurn: 1 },
  "池の主": { waterEater: 1 },
  "オロチャージ": { sgRate: 400 },
  "うんちく": { noElemSkill: 1 },
  "果汁100%": { deathSg: 300 },
  "超電磁パワー": { sgPower: 250 },
  "ムーンパワー": { benchHeal: 12 },
  // 流行りの型の妖怪のスキル
  "エクササイズ": { aura_atk: 100 },
  "ベンチウォーマー": { benchHeal: 10 }, "美脚": { benchHeal: 10 },
  "みらいよち": { evade: 150 },
  "超ガマン": { endure: 2 }, "猛虎のねばり": { endure: 1 },
  "なめらかオイル": { oil: 350, oilFree: 1 },
  "肉食オーラ": { atkBias: 500 }, "草食オーラ": { atkBias: -500 },
  "ひとまかせ": { relay: 1 },
  "トリプルヘッド": { skillAll: 1 },
  "わしのもの": { blessMagnet: 1 },
  "満を持す": { halfTurn: 1 },
};

// レア魂（名前 → 効果）。合わせる 2 つの魂は本家どおり（HONKE_RARE_SOULS.from）
var RARE_SOUL_FX = {
  "おんみつ魂": { hidden: 1, hideFull: 1 }, "スパルタ魂": { noLoafAll: 1 }, "壺ガード魂": { ironGuard: 150 }, "ガード魂": { guardOnly: 1 },
  "かんつう魂": { pierce: 1 }, "ちょうはつ魂": { taunt: 1 }, "閃光魂": { firstStrike: 1 }, "なめらかオイル魂": { oil: 350, oilFree: 1 },
  "こじらせ魂": { purifyHard: 500 }, "れんごく魂": { magic_fire: 1 }, "大滝魂": { magic_water: 1 }, "雷神魂": { magic_thunder: 1 },
  "いん石魂": { magic_earth: 1 }, "吹雪魂": { magic_ice: 1 }, "嵐魂": { magic_wind: 1 },
  "水の魂": { atkElem_water: 1 }, "火の魂": { atkElem_fire: 1 }, "雷の魂": { atkElem_thunder: 1 }, "土の魂": { atkElem_earth: 1 },
  "氷の魂": { atkElem_ice: 1 }, "風の魂": { atkElem_wind: 1 }, "ヤミ魂": { curseSure: 1 }, "黄泉魂": { healDown: 500 },
  "ブロッカー魂": { blocker: 1 }, "よびよせ魂": { noBattle: 1 }, "無の魂": { noElemSkill: 1 }, "モテモテ魂": { noBattle: 1 },
};
var RARE_SOUL_ID = { おんみつ魂: "onmitsu", スパルタ魂: "sparta", 壺ガード魂: "tsubo_guard", ガード魂: "guard", かんつう魂: "kantsuu",
  ちょうはつ魂: "chouhatsu", 閃光魂: "senkou", なめらかオイル魂: "oil", こじらせ魂: "kojirase", れんごく魂: "rengoku", 大滝魂: "ootaki",
  雷神魂: "raijin", いん石魂: "inseki", 吹雪魂: "fubuki", 嵐魂: "arashi", 水の魂: "mizu", 火の魂: "hi", 雷の魂: "kaminari",
  土の魂: "tsuchi", 氷の魂: "koori", 風の魂: "kaze", ヤミ魂: "yami", 黄泉魂: "yomi", ブロッカー魂: "blocker", よびよせ魂: "yobiyose",
  無の魂: "mu", モテモテ魂: "motemote" };

// ---- 登録 ----
var HONKE_BY_ID = new Map();
(() => {
  const role = e => e.skillMode === "heal" || e.ult.kind === "heal" ? "healer" : e.inspKind === "bless" && e.ult.kind !== "single" ? "buffer"
    : e.ult.kind === "curseAll" || e.inspKind === "curse" && e.defaultNature === "hinder" ? "disruptorStatus" : e.def >= Math.max(e.atk, e.spa) ? "wall"
    : e.spa > e.atk ? "caster" : "striker";
  const MOTION = { striker: ["dash", "pounce", "slash", "charge", "smash"], wall: ["slam", "rattle", "sway"], caster: ["float", "glow", "wave", "spin"],
    healer: ["float", "glow", "sway"], buffer: ["hop", "sway", "wave"], disruptorStatus: ["flicker", "float", "stretch"] };
  for (const e of HONKE_ROSTER) {
    if (ct.some(d => d.id === e.id)) continue;
    const def = { ...e };
    if (/^(赤鬼|青鬼|黒鬼)$/.test(e.name)) def.group = "oni"; // 本家の公式ルール：赤鬼・青鬼・黒鬼はどれか 1 体まで
    ct.push(def);
    HONKE_BY_ID.set(def.id, def);
    const r = role(e), ms = MOTION[r];
    zi[def.id] = { family: e.name, form: e.rank === "S" || e.rank === "A" ? 2 : e.rank === "B" || e.rank === "C" ? 1 : 0, role: r,
      motion: ms[e.seed % ms.length], line: e.ultName + "！", pitch: 180 + e.seed % 360, seed: e.seed };
  }
  for (const s of HONKE_RARE_SOULS) {
    Ni.push({ id: "rsoul_" + RARE_SOUL_ID[s.name], name: s.name, cat: "レア魂", mods: {}, special: null, only: null, honke: true,
      fx: RARE_SOUL_FX[s.name], desc: s.text + (RARE_SOUL_FX[s.name].noBattle ? "（対戦では効果なし）" : ""),
      recipe: s.from.map(x => x.replace(/魂$/, "") + "の魂").join("＋") });
  }
})();

// このゲームだけの調整（1 体ずつ）。fx は特性、soulFx・soulText は魂を上書きする
//   クリティカル率（critEye）は 64 分の いくつ、クリティカルの威力（critDmg）は 1000 で +100%
var HONKE_TUNE = {
  いのちとり: { soulFx: { critEye: 19 }, soulText: "クリティカル率アップ（30%）" }, // いのちとりの魂：19/64 ≒ 30%
};

// 本家の妖怪の特性（本家のスキル）と魂
function honkeTrait(def) {
  const tune = HONKE_TUNE[def.name] ?? {};
  const fx = { ...(HONKE_SKILL_FX[def.hskill] ?? { noBattle: 1 }), ...tune.fx };
  const text = HONKE_SKILL_TEXT[def.hskill] ?? "";
  const soulFx = { ...(def.soulFx ?? {}), ...tune.soulFx };
  const soulText = tune.soulText ?? def.soulText;
  const soulDesc = soulText ? soulText + (soulFx.noBattle ? "（対戦では効果なし）" : "") : "本家では魂にできない（効果なし）";
  return {
    name: def.hskill, fx, desc: text + (fx.noBattle ? "（対戦では効果なし）" : ""), detail: fxDesc(fx),
    soulName: `${def.name}の魂`, soulFx, soulMods: def.soulMods ?? {}, soulDesc, honke: !0,
  };
}
